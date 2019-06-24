import { Page } from 'puppeteer-core';

export class Selector {
  static fromAriaLabel = (selector: string) => {
    return `[aria-label="${selector}"]`;
  };

  static fromSelector = (selector: string) => {
    return selector;
  };
}

export interface PageObjectType {
  init: (page: Page) => Promise<void>;
  exists: () => Promise<void>;
  containsText: (text: string) => Promise<void>;
}

export interface ClickablePageObjectType extends PageObjectType {
  click: () => Promise<void>;
}

export interface InputPageObjectType extends PageObjectType {
  enter: (text: string) => Promise<void>;
}

export interface SelectPageObjectType extends PageObjectType {
  select: (text: string) => Promise<void>;
}

export class PageObject implements PageObjectType {
  protected page: Page = null;

  constructor(protected selector: string) {}

  init = async (page: Page): Promise<void> => {
    this.page = page;
  };

  exists = async (): Promise<void> => {
    const options = { visible: true } as any;
    await expect(this.page).not.toBeNull();
    await expect(this.page).toMatchElement(this.selector, options);
  };

  containsText = async (text: string): Promise<void> => {
    const options = { visible: true, text } as any;
    await expect(this.page).not.toBeNull();
    await expect(this.page).toMatchElement(this.selector, options);
  };
}

export class ClickablePageObject extends PageObject implements ClickablePageObjectType {
  constructor(selector: string) {
    super(selector);
  }

  click = async (): Promise<void> => {
    console.log('Trying to click on:', this.selector);
    await expect(this.page).not.toBeNull();
    await expect(this.page).toClick(this.selector);
  };
}

export class InputPageObject extends PageObject implements InputPageObjectType {
  constructor(selector: string) {
    super(selector);
  }

  enter = async (text: string): Promise<void> => {
    console.log(`Trying to enter text:${text} into:`, this.selector);
    await expect(this.page).not.toBeNull();
    await expect(this.page).toFill(this.selector, text);
  };
}

export class SelectPageObject extends PageObject implements SelectPageObjectType {
  constructor(selector: string) {
    super(selector);
  }

  select = async (text: string): Promise<void> => {
    console.log(`Trying to select text:${text} in dropdown:`, this.selector);
    await expect(this.page).not.toBeNull();
    await this.page.select(this.selector, text);
  };
}
