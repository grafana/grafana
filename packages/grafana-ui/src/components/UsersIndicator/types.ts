import { DateTimeInput } from '@grafana/data';

export interface UserView {
  user: {
    /** User's name, containing first + last name */
    name: string;
    /** URL to the user's avatar */
    avatarUrl?: string;
  };
  /** Datetime string when the user was last active */
  lastActiveAt: DateTimeInput;
}
