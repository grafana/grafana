import { Page, Response, Request } from '@playwright/test';
import * as prom from 'prom-client';

/**
 * Records and tracks network request body sizes.
 *
 * You must call listen() before page.goto() for accurate results - this ensures all responses
 * for a page are tracked.
 */
export class RequestsRecorder {
  #page: Page;

  #documentUrl: string | undefined;

  #requestsInFlight = 0;

  #currentRequests: Set<Request> = new Set<Request>();

  #inflatedSizeBytesCounter: prom.Counter<'type' | 'host_type'>;
  #transferSizeBytesCounter: prom.Counter<'type' | 'host_type'>;
  #requestCountCounter: prom.Counter<'type' | 'host_type'>;
  #resolve?: () => void;

  constructor(page: Page) {
    this.#page = page;

    this.#inflatedSizeBytesCounter = new prom.Counter({
      name: 'fe_perf_inflated_size_bytes',
      help: 'The size of the inflated response body in bytes',
      labelNames: ['type', 'host_type'],
      registers: [],
    });

    this.#transferSizeBytesCounter = new prom.Counter({
      name: 'fe_perf_transfer_size_bytes',
      help: 'The size of the transfered response body in bytes',
      labelNames: ['type', 'host_type'],
      registers: [],
    });

    this.#requestCountCounter = new prom.Counter({
      name: 'fe_perf_request_count',
      help: 'The number of requests made',
      labelNames: ['type', 'host_type'],
      registers: [],
    });
  }

  listen() {
    const handler = this.#handleResponse.bind(this);
    const reqHandler = this.#handleRequest.bind(this);
    this.#page.on('request', reqHandler);
    this.#page.on('response', handler);

    return () => {
      this.#page.off('response', handler);
      this.#page.off('request', reqHandler);

      if (this.#requestsInFlight === 0) {
        return Promise.resolve();
      }

      console.log('waiting for', this.#requestsInFlight, 'requests to finish');

      return new Promise<void>((resolve) => {
        this.#resolve = resolve;
      });
    };
  }

  async #handleRequest(request: Request) {
    const type = request.resourceType();

    // Once we've recieved a document response, create a list of requests that we'll count the responses of.
    // We also want to count the document request itself.
    if (this.#documentUrl || type === 'document') {
      this.#currentRequests.add(request);
    }
  }

  /*
   * The Playwright page object has have multiple page loads, and responses for one page may come in after the page
   * has been navigated away from. Attempting to get the body of these responses will results in an error, but is also
   * not what we want to track.
   *
   * To solve this, we wait for the 'document' response to come in (a new page has loaded) and then keep track of all
   * future requests. We only record responses for requests that were made after the document response.
   */
  async #handleResponse(response: Response) {
    const request = response.request();

    const url = response.url();
    const type = response.request().resourceType();

    // Record when a document response comes in so we can keep track of future requests
    if (type === 'document') {
      if (this.#documentUrl) {
        console.warn('recieved additional document response', url);
      }

      this.#documentUrl = url;
    }

    // Disregard responses that for requests that were initiated before the current page
    if (!this.#currentRequests.has(request)) {
      return;
    }

    this.#requestsInFlight += 1;
    const hostType = getHostType(response.url(), this.#documentUrl ?? '');

    // Attempting to get the body of an empty response results in an error, so guess if the response will be empty or not
    const statusCode = response.status();
    const noBodyStatusCode = statusCode <= 199 || statusCode === 204 || statusCode === 205 || statusCode === 304;

    if (!noBodyStatusCode) {
      const body = await response.body();
      this.#inflatedSizeBytesCounter.inc({ type, host_type: hostType }, body.length);
    }

    const sizes = await response.request().sizes();

    this.#transferSizeBytesCounter.inc(
      { type, host_type: hostType },
      sizes.responseBodySize + sizes.responseHeadersSize
    );
    this.#requestCountCounter.inc({ type, host_type: hostType });

    this.#requestsInFlight -= 1;

    if (this.#requestsInFlight === 0 && this.#resolve) {
      this.#resolve();
    }
  }

  getMetrics() {
    return [this.#inflatedSizeBytesCounter, this.#transferSizeBytesCounter, this.#requestCountCounter];
  }
}

/**
 * Instead of setting the request host as a label, which may have too high cardinality, we categorise
 * the host into a limited set of types.
 */
function getHostType(requestUrl: string, documentUrl: string) {
  const url = new URL(requestUrl);
  const hostname = url.hostname; // FYI `hostname` doesn't include port, `host` does

  const documentHost = new URL(documentUrl).hostname;

  if (hostname.match(/^grafana-assets\.grafana(-\w+)?\.net$/)) {
    return 'assets_cdn';
  }

  if (hostname.match(/^plugins-cdn\.grafana(-\w+)?\.net$/)) {
    return 'plugin_cdn';
  }

  if (hostname === documentHost) {
    return 'self';
  }

  return 'other';
}
