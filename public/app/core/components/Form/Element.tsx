import React, { PureComponent, ReactNode, ReactElement } from 'react';
import { Label } from './Label';
import { uniqueId } from 'lodash';

interface Props {
  label?: ReactNode;
  labelClassName?: string;
  id?: string;
  children: ReactElement<any>;
}

export class Element extends PureComponent<Props> {
  elementId: string = this.props.id || uniqueId('form-element-');

  get elementLabel() {
    const { label, labelClassName } = this.props;

    if (label) {
      return (
        <Label htmlFor={this.elementId} className={labelClassName}>
          {label}
        </Label>
      );
    }

    return null;
  }

  get children() {
    const { children } = this.props;

    return React.cloneElement(children, { id: this.elementId });
  }

  render() {
    return (
      <div className="our-custom-wrapper-class">
        {this.elementLabel}
        {this.children}
      </div>
    );
  }
}
