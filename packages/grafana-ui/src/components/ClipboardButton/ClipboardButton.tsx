import React, { PureComponent } from 'react';
import Clipboard from 'clipboard';
import { Button, ButtonProps } from '../Button/Button';

interface Props extends ButtonProps {
  getText(): string;
  onClipboardCopy?(e: Clipboard.Event): void;
  onClipboardError?(e: Clipboard.Event): void;
}

export class ClipboardButton extends PureComponent<Props> {
  // @ts-ignore
  private clipboard: Clipboard;
  // @ts-ignore
  private elem: HTMLButtonElement;

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
