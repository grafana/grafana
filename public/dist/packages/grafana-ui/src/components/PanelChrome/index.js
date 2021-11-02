import { LoadingIndicator } from './LoadingIndicator';
import { ErrorIndicator } from './ErrorIndicator';
import { PanelChrome as PanelChromeComponent } from './PanelChrome';
/**
 * @internal
 */
export var PanelChrome = PanelChromeComponent;
PanelChrome.LoadingIndicator = LoadingIndicator;
PanelChrome.ErrorIndicator = ErrorIndicator;
/**
 * Exporting the components for extensibility and since it is a good practice
 * according to the api-extractor.
 */
export { LoadingIndicator as PanelChromeLoadingIndicator, } from './LoadingIndicator';
export { ErrorIndicator as PanelChromeErrorIndicator, } from './ErrorIndicator';
export { usePanelContext, PanelContextProvider, PanelContextRoot } from './PanelContext';
export * from './types';
//# sourceMappingURL=index.js.map