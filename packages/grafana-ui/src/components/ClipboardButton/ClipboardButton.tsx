import React, { PureComponent } from 'react';
import Clipboard from 'clipboard';
import { Button, ButtonProps } from '../Button';

export interface Props extends ButtonProps {
  /** A function that returns text to be copied */
  getText(): string;
  /** Callback when the text has been successfully copied */
  onClipboardCopy?(e: Clipboard.Event): void;
  /** Callback when there was an error copying the text */
  onClipboardError?(e: Clipboard.Event): void;
}

export class ClipboardButton extends PureComponent<Props> {
  private clipboard!: Clipboard;
  private elem!: HTMLButtonElement;

  setRef = (elem: HTMLButtonElement) => {
    this.elem = elem;
  };

  componentDidMount() {
    const { getText, onClipboardCopy, onClipboardError } = this.props;

    this.clipboard = new Clipboard(this.elem, {
      text: () => getText(),
    });

    this.clipboard.on('success', (e: Clipboard.Event) => {
      onClipboardCopy && onClipboardCopy(e);
    });

    this.clipboard.on('error', (e: Clipboard.Event) => {
      onClipboardError && onClipboardError(e);
    });
  }

  componentWillUnmount() {
    this.clipboard.destroy();
  }

  render() {
    const { getText, onClipboardCopy, onClipboardError, children, ...buttonProps } = this.props;

    return (
      <Button {...buttonProps} ref={this.setRef}>
        {children}
      </Button>
    );
  }
}
