import React, { PureComponent } from 'react';

interface SignupProps {
  children(arg0: ChildProps): JSX.Element;
}

interface ChildProps {
  onSubmit(e: React.FocusEvent): void;
}

export class SignupCtrl extends PureComponent<SignupProps> {
  onSubmit = () => {};

  render() {
    const { children } = this.props;
    return (
      <>
        {children({
          onSubmit: this.onSubmit,
        })}
      </>
    );
  }
}
