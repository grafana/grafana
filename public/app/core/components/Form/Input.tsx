import React, { PureComponent } from 'react';
import classNames from 'classnames';
import { ValidationEvents, ValidationRule } from 'app/types';
import { validate, hasValidationEvent } from 'app/core/utils/validate';

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
  validationEvents?: ValidationEvents;
  hideErrorMessage?: boolean;

  // Override event props and append status as argument
  onBlur?: (event: React.FocusEvent<HTMLInputElement>, status?: InputStatus) => void;
  onFocus?: (event: React.FocusEvent<HTMLInputElement>, status?: InputStatus) => void;
  onChange?: (event: React.FormEvent<HTMLInputElement>, status?: InputStatus) => void;
}

export class Input extends PureComponent<Props> {
  static defaultProps = {
    className: '',
  };

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
      const errors = validate(evt.target.value, validationRules);
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
    Object.keys(EventsWithValidation).forEach((eventName: EventsWithValidation) => {
      if (hasValidationEvent(eventName, validationEvents) || restProps[eventName]) {
        inputElementProps[eventName] = async evt => {
          evt.persist(); // Needed for async. https://reactjs.org/docs/events.html#event-pooling
          if (hasValidationEvent(eventName, validationEvents)) {
            await this.validatorAsync(validationEvents[eventName]).apply(this, [evt]);
          }
          if (restProps[eventName]) {
            restProps[eventName].apply(null, [evt, this.status]);
          }
        };
      }
    });
    return inputElementProps;
  };

  render() {
    const { validationEvents, className, hideErrorMessage, ...restProps } = this.props;
    const { error } = this.state;
    const inputClassName = classNames('gf-form-input', { invalid: this.isInvalid }, className);
    const inputElementProps = this.populateEventPropsWithStatus(restProps, validationEvents);

    return (
      <div className="our-custom-wrapper-class">
        <input {...inputElementProps} className={inputClassName} />
        {error && !hideErrorMessage && <span>{error}</span>}
      </div>
    );
  }
}
