import React, { PureComponent, ChangeEvent } from 'react';
import classNames from 'classnames';
import { validate, EventsWithValidation, hasValidationEvent } from '../../utils';
import { ValidationEvents, ValidationRule } from '../../types';

export enum InputStatus {
  Invalid = 'invalid',
  Valid = 'valid',
}

interface Props extends React.HTMLProps<HTMLInputElement> {
  validationEvents?: ValidationEvents;
  hideErrorMessage?: boolean;
  inputRef?: React.LegacyRef<HTMLInputElement>;

  // Override event props and append status as argument
  onBlur?: (event: React.FocusEvent<HTMLInputElement>, status?: InputStatus) => void;
  onFocus?: (event: React.FocusEvent<HTMLInputElement>, status?: InputStatus) => void;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>, status?: InputStatus) => void;
}

interface State {
  error: string | null;
}

export class Input extends PureComponent<Props, State> {
  static defaultProps = {
    className: '',
  };

  state: State = {
    error: null,
  };

  get status() {
    return this.state.error ? InputStatus.Invalid : InputStatus.Valid;
  }

  get isInvalid() {
    return this.status === InputStatus.Invalid;
  }

  validatorAsync = (validationRules: ValidationRule[]) => {
    return (evt: ChangeEvent<HTMLInputElement>) => {
      const errors = validate(evt.target.value, validationRules);
      this.setState(prevState => {
        return { ...prevState, error: errors ? errors[0] : null };
      });
    };
  };

  populateEventPropsWithStatus = (restProps: any, validationEvents: ValidationEvents | undefined) => {
    const inputElementProps = { ...restProps };
    if (!validationEvents) {
      return inputElementProps;
    }
    Object.keys(EventsWithValidation).forEach(eventName => {
      if (hasValidationEvent(eventName as EventsWithValidation, validationEvents) || restProps[eventName]) {
        inputElementProps[eventName] = async (evt: ChangeEvent<HTMLInputElement>) => {
          evt.persist(); // Needed for async. https://reactjs.org/docs/events.html#event-pooling
          if (hasValidationEvent(eventName as EventsWithValidation, validationEvents)) {
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
    const { validationEvents, className, hideErrorMessage, inputRef, ...restProps } = this.props;
    const { error } = this.state;
    const inputClassName = classNames('gf-form-input', { invalid: this.isInvalid }, className);
    const inputElementProps = this.populateEventPropsWithStatus(restProps, validationEvents);

    return (
      <div style={{ flexGrow: 1 }}>
        <input {...inputElementProps} ref={inputRef} className={inputClassName} />
        {error && !hideErrorMessage && <span>{error}</span>}
      </div>
    );
  }
}
