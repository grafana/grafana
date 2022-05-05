export function reverseMap<T, Q>(arr: ArrayLike<T>, callbackfn: (value: T, index: number, array: ArrayLike<T>) => Q) {
  const reversedAndMapped = new Array<Q>(arr.length);
  for (let i = 0; i < arr.length; i++) {
    const reverseIndex = arr.length - 1 - i;
    reversedAndMapped[i] = callbackfn(arr[reverseIndex], reverseIndex, arr);
  }

  return reversedAndMapped;
}
