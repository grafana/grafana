// this class generates react-keys that are guaranteed to be unique.
// it will try to use the provided `maybeId`, but if that's a duplicate,
// it will use an index-based key.
// NOTE: it will always add a prefix to the string, this is necessary
// to avoid the problem if your proposed key would conflict with
// the index-based names
export class UniqueKeyMaker {
  seen: Set<string>;
  count: number;
  constructor() {
    this.seen = new Set();
    this.count = 0;
  }

  getKey(proposedKey: string) {
    this.count += 1;
    const maybeKey = `k_${proposedKey}`;
    if (this.seen.has(maybeKey)) {
      return `i_${this.count}`;
    } else {
      this.seen.add(maybeKey);
      return maybeKey;
    }
  }
}
