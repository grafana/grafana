import * as z from 'zod/mini';

import { isIconName, type IconName } from '@grafana/data';

const UserListTabSchema = z.object({
  id: z.string(),
  label: z.string(),
  icon: z.optional(z.pipe(z.string(), z.custom<IconName>(isIconName, { error: 'Unknown icon' }))),
  counter: z.optional(z.number()),
});

export type UserListTab = z.infer<typeof UserListTabSchema>;

export function validateUserListTab(value: unknown): asserts value is UserListTab {
  const result = UserListTabSchema.safeParse(value);
  if (!result.success) {
    throw new Error(`Invalid tab object returned from extension: ${z.prettifyError(result.error)}`);
  }
}

export interface UserListTabExtensionProps {
  active: boolean;
  register: (tab: UserListTab) => () => void;
}
