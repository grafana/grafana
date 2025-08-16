import { Page, Response, Request } from '@playwright/test';
import * as prom from 'prom-client';

interface RequestMetrics {
  type: string;
  inflatedSizeBytes: number;
  transferSizeBytes: number;
  requestCount: number;
}

/**
 * Records and tracks network request body sizes.
 *
 * You must call listen() before page.goto() for accurate results - this ensures all responses
 * for a page are tracked.
 */
export class RequestsRecorder {
  #page: Page;

  // #metricsForRequestType: Record<string, RequestMetrics> = {};

  #documentHasLoaded = false;

  #responsesInFlight = 0;

  #currentRequests: Set<Request> = new Set<Request>();

  #inflatedSizeBytesCounter: prom.Counter<'type'>;
  #transferSizeBytesCounter: prom.Counter<'type'>;
  #requestCountCounter: prom.Counter<'type'>;

  constructor(page: Page) {
    this.#page = page;

    this.#inflatedSizeBytesCounter = new prom.Counter({
      name: 'inflated_size_bytes',
      help: 'The size of the inflated response body in bytes',
      labelNames: ['type'],
      registers: [],
    });

    this.#transferSizeBytesCounter = new prom.Counter({
      name: 'transfer_size_bytes',
      help: 'The size of the transfered response body in bytes',
      labelNames: ['type'],
      registers: [],
    });

    this.#requestCountCounter = new prom.Counter({
      name: 'request_count',
      help: 'The number of requests made',
      labelNames: ['type'],
      registers: [],
    });
  }

  listen() {
    const handler = this.#handleResponse.bind(this);
    const reqHandler = this.#handleRequest.bind(this);
    this.#page.on('request', reqHandler);
    this.#page.on('response', handler);

    return () => {
      console.log('Removing response listener');
      this.#page.off('response', handler);
      this.#page.off('request', reqHandler);
    };
  }

  async #handleRequest(request: Request) {
    const type = request.resourceType();

    // Once we've recieved a document response, create a list of requests that we'll count the responses of.
    // We also want to count the document request itself.
    if (this.#documentHasLoaded || type === 'document') {
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
      if (this.#documentHasLoaded) {
        console.warn('recieved additional document response', url);
      }

      this.#documentHasLoaded = true;
    }

    // Disregard responses that for requests that were initiated before the current page
    if (!this.#currentRequests.has(request)) {
      return;
    }

    this.#responsesInFlight += 1;

    // Attempting to get the body of an empty response results in an error, so guess if the response will be empty or not
    const statusCode = response.status();
    const noBodyStatusCode = statusCode <= 199 || statusCode === 204 || statusCode === 205 || statusCode === 304;

    if (!noBodyStatusCode) {
      const body = await response.body();
      this.#inflatedSizeBytesCounter.inc({ type }, body.length);
    }

    const sizes = await response.request().sizes();

    this.#transferSizeBytesCounter.inc({ type }, sizes.responseBodySize + sizes.responseHeadersSize);
    this.#requestCountCounter.inc({ type });
    this.#responsesInFlight -= 1;
  }

  waitForResponsesToFinish() {
    console.log('Waiting for all responses to finish');
    return new Promise<void>((resolve) => {
      const check = () => {
        console.log(this.#responsesInFlight, 'responses in flight');

        if (this.#responsesInFlight === 0) {
          console.log('All responses finished, resolving');
          resolve();
        } else {
          console.log('NOT all responses finished, checking again in 100ms');
          setTimeout(check, 100);
        }
      };

      check();
    });
  }

  getMetrics() {
    return [this.#inflatedSizeBytesCounter, this.#transferSizeBytesCounter, this.#requestCountCounter];
  }
}
