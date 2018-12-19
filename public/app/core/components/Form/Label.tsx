import React, { PureComponent, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}

export class Label extends PureComponent<Props> {
  render() {
    const { children, htmlFor, className } = this.props;

    return (
      <label className={`custom-label-class ${className || ''}`} htmlFor={htmlFor}>
        {children}
      </label>
    );
  }
}
