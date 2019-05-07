import React from 'react';

export interface Props {
  password: string;
}

export class PasswordStrength extends React.Component<Props, any> {
  constructor(props: Props) {
    super(props);

    this.state = {
      getScore(password: string) {
        if (password.length < 4) {
          return 1;
        }
        if (password.length < 8) {
          return 2;
        }
        return 3;
      },
    };
  }

  componentDidMount() {
    import(/* webpackChunkName: "zxcvbn" */ 'zxcvbn').then(zxcvbn => {
      this.setState({
        getScore(password: string) {
          return zxcvbn.default(password).score;
        },
      });
    });
  }

  render() {
    const { password } = this.props;
    let strengthText = 'strength: strong like a bull.';
    let strengthClass = 'password-strength-good';

    if (!password) {
      return null;
    }

    const passwordScore = this.state.getScore(password);

    if (passwordScore <= 2) {
      strengthText = 'strength: you can do better.';
      strengthClass = 'password-strength-ok';
    }

    if (passwordScore <= 1) {
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
