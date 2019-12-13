import { Page } from 'puppeteer-core';

export class Selector {
  static fromAriaLabel = (selector: string) => {
    return `[aria-label="${selector}"]`;
  };

  static fromSwitchLabel = (selector: string) => {
    return `${Selector.fromAriaLabel(selector)} .gf-form-switch input`;
  };

  static fromSelector = (selector: string) => {
    return selector;
  };
}

export interface PageObjectType {
  init: (page: Page) => Promise<void>;
  exists: () => Promise<void>;
  containsText: (text: string) => Promise<void>;
  waitForSelector: (timeoutInMs?: number) => Promise<void>;
}

export interface ClickablePageObjectType extends PageObjectType {
  click: () => Promise<void>;
}

export interface InputPageObjectType extends PageObjectType {
  enter: (text: string) => Promise<void>;
  containsPlaceholder: (text: string) => Promise<void>;
  blur: () => Promise<void>;
}

export interface SelectPageObjectType extends PageObjectType {
  select: (text: string) => Promise<void>;
  selectedTextIs: (text: string) => Promise<void>;
}

export interface SwitchPageObjectType extends PageObjectType {
  toggle: () => Promise<void>;
  isSwitchedOn: () => Promise<void>;
  isSwitchedOff: () => Promise<void>;
}

export interface ArrayPageObjectType {
  hasLength: (length: number) => Promise<void>;
  clickAtPos: (index: number) => Promise<void>;
  containsTextAtPos: (text: string, index: number) => Promise<void>;
  waitForSelector: (timeoutInMs?: number) => Promise<void>;
}

export class PageObject
  implements
    PageObjectType,
    ClickablePageObjectType,
    InputPageObjectType,
    SelectPageObjectType,
    SwitchPageObjectType,
    ArrayPageObjectType {
  protected page?: Page;

  constructor(protected selector: string) {}

  init = async (page: Page): Promise<void> => {
    this.page = page;
  };

  exists = async (): Promise<void> => {
    console.log('Checking for existence of:', this.selector);
    const options = { visible: true } as any;
    await expect(this.page).not.toBeNull();
    await expect(this.page).toMatchElement(this.selector, options);
  };

  containsText = async (text: string): Promise<void> => {
    console.log(`Checking for existence of '${text}' for:`, this.selector);
    const options = { visible: true, text } as any;
    await expect(this.page).not.toBeNull();
    await expect(this.page).toMatchElement(this.selector, options);
  };

  containsPlaceholder = async (expectedPlaceholder: string): Promise<void> => {
    console.log(`Checking for placeholder '${expectedPlaceholder}' in:`, this.selector);
    await expect(this.page).not.toBeNull();
    const placeholder = await this.page!.$eval(this.selector, (input: any) => input.placeholder);
    await expect(placeholder).toEqual(expectedPlaceholder);
  };

  hasLength = async (length: number): Promise<void> => {
    console.log('Checking for length of', this.selector);
    const result = await this.page!.$$eval(this.selector, elements => elements.length);
    await expect(result).toEqual(length);
  };

  containsTextAtPos = async (text: string, index: number): Promise<void> => {
    console.log(`Checking for text ${text} at position ${index} of`, this.selector);
    await expect(this.page).not.toBeNull();
    const result = await this.page!.$$eval(this.selector, elements => elements.map((el: any) => el.innerText));
    await expect(result[index]!.trim()).toEqual(text);
  };

  click = async (): Promise<void> => {
    console.log('Trying to click on:', this.selector);
    await expect(this.page).not.toBeNull();
    await expect(this.page).toClick(this.selector);
  };

  clickAtPos = async (index: number): Promise<void> => {
    console.log(`Trying to clicking at position:${index} on:`, this.selector);
    await expect(this.page).not.toBeNull();
    const elements = await this.page!.$$(this.selector);
    const element = await elements[index];
    await element.click();
  };

  toggle = async (): Promise<void> => {
    const switchSelector = this.selector.replace(' .gf-form-switch input', '');
    console.log('Trying to toggle:', switchSelector);
    await expect(this.page).not.toBeNull();
    await expect(this.page).toClick(switchSelector);
  };

  enter = async (text: string): Promise<void> => {
    console.log(`Trying to enter text:${text} into:`, this.selector);
    await expect(this.page).not.toBeNull();
    await expect(this.page).toFill(this.selector, text);
  };

  select = async (text: string): Promise<void> => {
    console.log(`Trying to select text:${text} in dropdown:`, this.selector);
    await expect(this.page).not.toBeNull();
    await this.page!.select(this.selector, text);
  };

  selectedTextIs = async (text: string): Promise<void> => {
    console.log(`Trying to get selected text from dropdown:`, this.selector);
    await expect(this.page).not.toBeNull();
    const selectedText = await this.page!.$eval(this.selector, (select: any) => {
      if (select.selectedIndex === -1) {
        return '';
      }
      return select.options[select.selectedIndex].innerText;
    });
    await expect(selectedText).toEqual(text);
  };

  waitForSelector = async (timeoutInMs?: number): Promise<void> => {
    console.log('Waiting for', this.selector);
    await expect(this.page).not.toBeNull();
    await this.page!.waitForSelector(this.selector, { timeout: timeoutInMs || 1000 });
  };

  isSwitchedOn = async (): Promise<void> => {
    const checked = await this.getChecked();
    await expect(checked).toBe(true);
  };

  isSwitchedOff = async (): Promise<void> => {
    const checked = await this.getChecked();
    await expect(checked).toBe(false);
  };

  blur = async (): Promise<void> => {
    console.log('Trying to blur:', this.selector);
    await expect(this.page).not.toBeNull();
    await this.page!.$eval(this.selector, (input: any) => input.blur());
  };

  private getChecked = async (): Promise<boolean> => {
    console.log('Trying get switch status for:', this.selector);
    await expect(this.page).not.toBeNull();
    return await this.page!.$eval(this.selector, (input: any) => input.checked);
  };
}
