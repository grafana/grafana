import type { Page, Response } from '@playwright/test';

export class PageResponseRecorder {
  private page: Page;

  private inflatedSize = 0;
  private transferSize = 0;
  private requests = 0;

  private currentDocument: string | undefined = undefined;

  constructor(page: Page) {
    this.page = page;
  }

  listen() {
    this.page.on('response', this.processResponse.bind(this));

    return () => {
      this.page.off('response', this.processResponse.bind(this));
      this.currentDocument = undefined;
    };
  }

  async processResponse(response: Response) {
    // Take note of when a 'document' request comes in, indicating the page.goto
    // page load has completed
    const resourceType = response.request().resourceType();
    if (resourceType === 'document') {
      // If *another* document is loaded for some reason, log a warning. Hopefully
      // this shouldn't happen.
      if (this.currentDocument) {
        console.warn('Warning: A new page was unexpectedly loaded. Metrics may be incorrect');
      }

      this.currentDocument = response.url();
    }

    // If we haven't received a document request yet, don't record response metrics
    if (this.currentDocument === undefined) {
      return;
    }

    // Only tally up successful responses
    if (response.status() !== 200) {
      return;
    }

    try {
      const body = await response.body();
      const sizes = await response.request().sizes();

      this.inflatedSize += body.length;
      this.transferSize += sizes.responseBodySize + sizes.responseHeadersSize;
      this.requests++;
    } catch (err) {
      // If the page closes in the middle of us handling a request, playwright throws
      // this error that we can just ignore
      if (err.message.includes('No resource with given identifier found')) {
        return;
      }

      throw err;
    }
  }

  getMetrics() {
    return {
      inflatedSize: this.inflatedSize,
      transferSize: this.transferSize,
      requests: this.requests,
    };
  }
}
