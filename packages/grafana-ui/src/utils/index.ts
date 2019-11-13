export * from './colors';
export * from './validate';
export * from './slate';
export * from './dataLinks';
export * from './tags';
export { default as ansicolor } from './ansicolor';

// Export with a namespace
import * as DOMUtil from './dom'; // includes Element.closest polyfil
export { DOMUtil };
