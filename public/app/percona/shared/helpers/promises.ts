export interface FulfilledPromiseResult {
  status: 'fulfilled';
  value: any;
}

export interface RejectedPromiseResult {
  status: 'rejected';
  reason: any;
}

export type PromiseResult = FulfilledPromiseResult | RejectedPromiseResult;

export const processPromiseResults = (requests: Array<Promise<any>>): Promise<PromiseResult[]> =>
  Promise.all(
    requests.map((promise) =>
      promise
        .then(
          (value): FulfilledPromiseResult => ({
            status: 'fulfilled',
            value,
          })
        )
        .catch(
          (reason): RejectedPromiseResult => ({
            status: 'rejected',
            reason,
          })
        )
    )
  );

export const filterFulfilled = ({ status }: { status: PromiseResult['status'] }) => status === 'fulfilled';
export const filterRejected = ({ status }: { status: PromiseResult['status'] }) => status === 'rejected';
