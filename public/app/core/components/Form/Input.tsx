import React, { PureComponent } from 'react';
import { ValidationRule } from 'app/types';

export enum InputStatus {
  Default = 'default',
  Loading = 'loading',
  Invalid = 'invalid',
  Valid = 'valid',
}

export enum InputTypes {
  Text = 'text',
  Number = 'number',
  Password = 'password',
  Email = 'email',
}

interface Props {
  status?: InputStatus;
  validationRules: ValidationRule[];
  hideErrorMessage?: boolean;
  onBlurWithStatus?: (evt, status: InputStatus) => void;
  emptyToNull?: boolean;
}

const validator = (value: string, validationRules: ValidationRule[]) => {
  const errors = validationRules.reduce((acc, currRule) => {
    if (!currRule.rule(value)) {
      return acc.concat(currRule.errorMessage);
    }
    return acc;
  }, []);
  return errors.length > 0 ? errors : null;
};

export class Input extends PureComponent<Props & React.HTMLProps<HTMLInputElement>> {
  state = {
    error: null,
  };

  get status() {
    const { error } = this.state;
    if (error) {
      return InputStatus.Invalid;
    }
    return InputStatus.Valid;
  }

  onBlurWithValidation = evt => {
    const { validationRules, onBlurWithStatus, onBlur } = this.props;

    let errors = null;
    if (validationRules) {
      errors = validator(evt.currentTarget.value, validationRules);
      this.setState(prevState => {
        return {
          ...prevState,
          error: errors ? errors[0] : null,
        };
      });
    }

    if (onBlurWithStatus) {
      onBlurWithStatus(evt, errors ? InputStatus.Invalid : InputStatus.Valid);
    }

    if (onBlur) {
      onBlur(evt);
    }
  };

  render() {
    const {
      status,
      validationRules,
      onBlurWithStatus,
      onBlur,
      className,
      hideErrorMessage,
      emptyToNull,
      ...restProps
    } = this.props;

    const { error } = this.state;

    let inputClassName = 'gf-form-input';
    inputClassName = this.status === InputStatus.Invalid ? inputClassName + ' invalid' : inputClassName;

    return (
      <div className="our-custom-wrapper-class">
        <input {...restProps} onBlur={this.onBlurWithValidation} className={inputClassName} />
        {error && !hideErrorMessage && <span>{error}</span>}
      </div>
    );
  }
}
