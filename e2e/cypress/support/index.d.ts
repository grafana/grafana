/// <reference types="cypress" />

declare namespace Cypress {
  interface Chainable {
    logToConsole(message: string, optional?: unknown): void;
    readProvisions(filePaths: string[]): Chainable;
    getJSONFilesFromDir(dirPath: string): Chainable;
    startBenchmarking(testName: string): void;
    stopBenchmarking(testName: string, appStats: Record<string, unknown>): void;
    checkHealthRetryable(fn: Function, retryCount: number): Chainable;
    setLocalStorage(key: string, value: string);
  }

  interface Chainer<Subject extends JQuery<HTMLElement>> {
    (chainer: 'be.higherThan'): Chainable<Subject>;
    (chainer: 'be.lowerThan'): Chainable<Subject>;
    (chainer: 'be.leftOf'): Chainable<Subject>;
    (chainer: 'be.rightOf'): Chainable<Subject>;
  }
}
