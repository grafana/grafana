import React from 'react';
import zxcvbn from 'zxcvbn';

export interface Props {
  password: string;
}

export class PasswordStrength extends React.Component<Props, any> {
  constructor(props: Props) {
    super(props);
  }

  render() {
    const { password } = this.props;
    let strengthText = 'strength: strong like a bull.';
    let strengthClass = 'password-strength-good';

    if (!password) {
      return null;
    }

    const passwordScore = zxcvbn(password).score;

    if (passwordScore <= 2) {
      strengthText = 'strength: you can do better.';
      strengthClass = 'password-strength-ok';
    }

    if (passwordScore < 1) {
      strengthText = 'strength: weak sauce.';
      strengthClass = 'password-strength-bad';
    }

    return (
      <div className={`password-strength small ${strengthClass}`}>
        <em>{strengthText}</em>
      </div>
    );
  }
}
