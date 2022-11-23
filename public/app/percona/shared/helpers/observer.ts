/**
 * Returns a promise that resolves when an element is available in DOM
 * @param selector query selector of the element
 * @returns resolves when element is available in DOM
 */
export const waitForVisible = (selector: string) =>
  new Promise<boolean>((resolve) => {
    if (document.querySelector(selector)) {
      return resolve(true);
    }

    const observer = new MutationObserver(() => {
      if (document.querySelector(selector)) {
        resolve(true);
        observer.disconnect();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  });
