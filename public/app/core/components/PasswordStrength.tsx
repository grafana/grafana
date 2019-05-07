import React, { PureComponent } from 'react';

export interface Props {
  password: string;
}

export class PasswordStrength extends PureComponent<Props, any> {
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
    let strengthText = 'strong like a bull.';
    let strengthClassModifier = 'good';

    if (!password) {
      return null;
    }

    const passwordScore = this.state.getScore(password);

    if (passwordScore <= 2) {
      strengthText = 'you can do better.';
      strengthClassModifier = 'ok';
    }

    if (passwordScore <= 1) {
      strengthText = 'weak sauce.';
      strengthClassModifier = 'bad';
    }

    return (
      <div className={`password-strength small password-strength-${strengthClassModifier}`}>
        <em>strength: {strengthText}</em>
      </div>
    );
  }
}
