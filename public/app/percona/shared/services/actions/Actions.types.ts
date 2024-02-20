export interface ActionResult<T = object> {
  error: string;
  loading: boolean;
  value: T | null;
}

export interface ActionRequest {
  action_id: string;
}

export interface ActionResponse<T = object> {
  done: boolean;
  error: string;
  output: T;
}
