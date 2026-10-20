// Code generated - EDITING IS FUTILE. DO NOT EDIT.

export interface Spec {
  // apiGroup is the first label of the declared kind's group. It must be a DNS label.
  apiGroup: string;
  // name is the declared kind's name, such as Widget.
  name: string;
}

export const defaultSpec = (): Spec => ({
  apiGroup: '',
  name: '',
});
