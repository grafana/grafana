import React, { PureComponent, ReactNode } from 'react';
import ClipboardJS from 'clipboard';

interface Props {
  text: () => string;
  elType?: string;
  onSuccess?: (evt: any) => void;
  onError?: (evt: any) => void;
  className?: string;
  children?: ReactNode;
}

export class CopyToClipboard extends PureComponent<Props> {
  clipboardjs: ClipboardJS;
  myRef: any;

  constructor(props: Props) {
    super(props);
    this.myRef = React.createRef();
  }

  componentDidMount() {
    const { text, onSuccess, onError } = this.props;

    this.clipboardjs = new ClipboardJS(this.myRef.current, {
      text: text,
    });

    if (onSuccess) {
      this.clipboardjs.on('success', evt => {
        evt.clearSelection();
        onSuccess(evt);
      });
    }

    if (onError) {
      this.clipboardjs.on('error', evt => {
        console.error('Action:', evt.action);
        console.error('Trigger:', evt.trigger);
        onError(evt);
      });
    }
  }

  componentWillUnmount() {
    if (this.clipboardjs) {
      this.clipboardjs.destroy();
    }
  }

  getElementType = () => {
    return this.props.elType || 'button';
  };

  render() {
    const { elType, text, children, onError, onSuccess, ...restProps } = this.props;

    return React.createElement(
      this.getElementType(),
      {
        ref: this.myRef,
        ...restProps,
      },
      this.props.children
    );
  }
}
