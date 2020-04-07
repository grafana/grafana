/**
 * Set of handlers for secure password field in Angular components. They handle backward compatibility with
 * passwords stored in plain text fields.
 */

import { SyntheticEvent } from 'react';

export enum PasswordFieldEnum {
  Password = 'password',
  BasicAuthPassword = 'basicAuthPassword',
}

/**
 * Basic shape for settings controllers in at the moment mostly angular datasource plugins.
 */
export type Ctrl = {
  current: {
    secureJsonFields: {
      [key: string]: boolean;
    };
    secureJsonData?: {
      [key: string]: string;
    };
    password?: string;
    basicAuthPassword?: string;
  };
};

export const createResetHandler = (ctrl: Ctrl, field: PasswordFieldEnum) => (
  event: SyntheticEvent<HTMLInputElement>
) => {
  event.preventDefault();
  // Reset also normal plain text password to remove it and only save it in secureJsonData.
  ctrl.current[field] = null;
  ctrl.current.secureJsonFields[field] = false;
  ctrl.current.secureJsonData = ctrl.current.secureJsonData || {};
  ctrl.current.secureJsonData[field] = '';
};

export const createChangeHandler = (ctrl: any, field: PasswordFieldEnum) => (
  event: SyntheticEvent<HTMLInputElement>
) => {
  ctrl.current.secureJsonData = ctrl.current.secureJsonData || {};
  ctrl.current.secureJsonData[field] = event.currentTarget.value;
};
