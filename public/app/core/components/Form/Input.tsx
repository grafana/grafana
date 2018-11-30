import React, { PureComponent } from 'react';
import { ValidationEvents, ValidationRule } from 'app/types';
import { validate } from 'app/core/utils/validate';

export enum InputStatus {
  Invalid = 'invalid',
  Valid = 'valid',
}

export enum InputTypes {
  Text = 'text',
  Number = 'number',
  Password = 'password',
  Email = 'email',
}

export enum EventsWithValidation {
  onBlur = 'onBlur',
  onFocus = 'onFocus',
  onChange = 'onChange',
}

interface Props extends React.HTMLProps<HTMLInputElement> {
  validationEvents: ValidationEvents;
  hideErrorMessage?: boolean;

  // Override event props and append status as argument
  onBlur?: (event: React.FocusEvent<HTMLInputElement>, status?: InputStatus) => void;
  onFocus?: (event: React.FocusEvent<HTMLInputElement>, status?: InputStatus) => void;
  onChange?: (event: React.FormEvent<HTMLInputElement>, status?: InputStatus) => void;
}

export class Input extends PureComponent<Props> {
  state = {
    error: null,
  };

  get status() {
    return this.state.error ? InputStatus.Invalid : InputStatus.Valid;
  }

  get isInvalid() {
    return this.status === InputStatus.Invalid;
  }

  validatorAsync = (validationRules: ValidationRule[]) => {
    return evt => {
      const errors = validate(evt.currentTarget.value, validationRules);
      this.setState(prevState => {
        return {
          ...prevState,
          error: errors ? errors[0] : null,
        };
      });
    };
  };

  populateEventPropsWithStatus = (restProps, validationEvents: ValidationEvents) => {
    const inputElementProps = { ...restProps };
    Object.keys(EventsWithValidation).forEach(eventName => {
      inputElementProps[eventName] = async evt => {
        if (validationEvents[eventName]) {
          await this.validatorAsync(validationEvents[eventName]).apply(this, [evt]);
        }
        if (restProps[eventName]) {
          restProps[eventName].apply(null, [evt, this.status]);
        }
      };
    });
    return inputElementProps;
  };

  render() {
    const { validationEvents, className, hideErrorMessage, ...restProps } = this.props;
    const { error } = this.state;
    const inputClassName = 'gf-form-input' + (this.isInvalid ? ' invalid' : '');
    const inputElementProps = this.populateEventPropsWithStatus(restProps, validationEvents);

    return (
      <div className="our-custom-wrapper-class">
        <input {...inputElementProps} className={inputClassName} />
        {error && !hideErrorMessage && <span>{error}</span>}
      </div>
    );
  }
}
