/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions */
export type VResult = string | undefined;

export type Validator<T = any> = (value: T, values?: Record<string, any>, meta?: any) => VResult;
export type GetSelectValueFunction<T> = (incomingValue: T) => any;
