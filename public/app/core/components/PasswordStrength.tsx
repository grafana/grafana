import React from 'react';

export interface IProps {
  password: string;
}

export class PasswordStrength extends React.Component<IProps, any> {

  constructor(props) {
    super(props);
  }

  render() {
    const { password } = this.props;
    let strengthText = "strength: strong like a bull.";
    let strengthClass = "password-strength-good";

    if (!password) {
      return null;
    }

    if (password.length <= 8) {
      strengthText = "strength: you can do better.";
      strengthClass = "password-strength-ok";
    }

    if (password.length < 4) {
      strengthText = "strength: weak sauce.";
      strengthClass = "password-strength-bad";
    }

    return (
      <div className={`password-strength small ${strengthClass}`}>
        <em>{strengthText}</em>
      </div>
    );
  }
}


