export type Action = InitNavModelAction;

export interface InitNavModelAction {
  type: 'INIT_NAV_MODEL';
  args: string[];
}

export const initNav = (...args: string[]): InitNavModelAction => ({
  type: 'INIT_NAV_MODEL',
  args: args,
});
