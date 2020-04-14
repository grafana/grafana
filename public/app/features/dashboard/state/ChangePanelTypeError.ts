/**
 * Send a signal that the panel type should change
 */
export class ChangePanelTypeError extends Error {
  changePanelType: string;

  constructor(panelType: string) {
    // Pass remaining arguments (including vendor specific ones) to parent constructor
    super();

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ChangePanelTypeError);
    }

    this.name = 'PanelTypeShouldChange';
    this.changePanelType = panelType;
  }
}
