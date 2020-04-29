import React, { FC, SyntheticEvent } from 'react';
import { Tooltip, Form, Field, Input, HorizontalGroup, Button, LinkButton } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';

interface Props {
  onSubmit: (pw: string) => void;
  onSkip: (event?: SyntheticEvent) => void;
}

interface PasswordDTO {
  newPassword: string;
  confirmNew: string;
}

export const ChangePassword: FC<Props> = ({ onSubmit, onSkip }) => {
  const submit = (passwords: PasswordDTO) => {
    onSubmit(passwords.newPassword);
  };
  return (
    <Form onSubmit={submit}>
      {({ errors, register, getValues }) => (
        <>
          <Field label="New password" invalid={!!errors.newPassword} error={errors?.newPassword?.message}>
            <Input
              autoFocus
              type="password"
              name="newPassword"
              ref={register({
                required: 'New password required',
              })}
            />
          </Field>
          <Field label="Confirmn new password" invalid={!!errors.confirmNew} error={errors?.confirmNew?.message}>
            <Input
              type="password"
              name="confirmNew"
              ref={register({
                required: 'Confirmed password is required',
                validate: v => v === getValues().newPassword || 'Passwords must match!',
              })}
            />
          </Field>
          <HorizontalGroup>
            <Tooltip
              content="If you skip you will be prompted to change password next time you login."
              placement="bottom"
            >
              <LinkButton variant="link" onClick={onSkip} aria-label={selectors.pages.Login.skip}>
                Skip
              </LinkButton>
            </Tooltip>
            <Button type="submit">Submit</Button>
          </HorizontalGroup>
        </>
      )}
    </Form>
  );
};

// export class ChangePassword extends PureComponent<Props, State> {
//   private userInput: HTMLInputElement;
//   constructor(props: Props) {
//     super(props);
//     this.state = {
//       newPassword: '',
//       confirmNew: '',
//       valid: false,
//     };
//   }

//   componentDidUpdate(prevProps: Props) {
//     if (!prevProps.focus && this.props.focus) {
//       this.focus();
//     }
//   }

//   focus() {
//     this.userInput.focus();
//   }

//   onSubmit = (e: SyntheticEvent) => {
//     e.preventDefault();

//     const { newPassword, valid } = this.state;
//     if (valid) {
//       this.props.onSubmit(newPassword);
//     } else {
//       appEvents.emit(AppEvents.alertWarning, ['New passwords do not match']);
//     }
//   };

//   onNewPasswordChange = (e: ChangeEvent<HTMLInputElement>) => {
//     this.setState({
//       newPassword: e.target.value,
//       valid: this.validate('newPassword', e.target.value),
//     });
//   };

//   onConfirmPasswordChange = (e: ChangeEvent<HTMLInputElement>) => {
//     this.setState({
//       confirmNew: e.target.value,
//       valid: this.validate('confirmNew', e.target.value),
//     });
//   };

//   onSkip = (e: SyntheticEvent) => {
//     this.props.onSkip();
//   };

//   validate(changed: string, pw: string) {
//     if (changed === 'newPassword') {
//       return this.state.confirmNew === pw;
//     } else if (changed === 'confirmNew') {
//       return this.state.newPassword === pw;
//     }
//     return false;
//   }

//   render() {
//     return (
//       <div className="login-inner-box" id="change-password-view">
//         <div className="text-left login-change-password-info">
//           <h5>Change Password</h5>
//           Before you can get started with awesome dashboards we need you to make your account more secure by changing
//           your password.
//           <br />
//           You can change your password again later.
//         </div>
//         <form className="login-form-group gf-form-group">
//           <div className="login-form">
//             <input
//               type="password"
//               id="newPassword"
//               name="newPassword"
//               className="gf-form-input login-form-input"
//               required
//               placeholder="New password"
//               onChange={this.onNewPasswordChange}
//               ref={input => {
//                 this.userInput = input;
//               }}
//             />
//           </div>
//           <div className="login-form">
//             <input
//               type="password"
//               name="confirmNew"
//               className="gf-form-input login-form-input"
//               required
//               ng-model="command.confirmNew"
//               placeholder="Confirm new password"
//               onChange={this.onConfirmPasswordChange}
//             />
//           </div>
//           <div className="login-button-group login-button-group--right text-right">
//             <Tooltip
//               placement="bottom"
//               content="If you skip you will be prompted to change password next time you login."
//             >
//               <a className="btn btn-link" onClick={this.onSkip} aria-label={selectors.pages.Login.skip}>
//                 Skip
//               </a>
//             </Tooltip>

//             <button
//               type="submit"
//               className={`btn btn-large p-x-2 ${this.state.valid ? 'btn-primary' : 'btn-inverse'}`}
//               onClick={this.onSubmit}
//               disabled={!this.state.valid}
//             >
//               Save
//             </button>
//           </div>
//         </form>
//       </div>
//     );
//   }
// }
