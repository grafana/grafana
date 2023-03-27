export class PlacementsPerPlugin {
  private counter: Record<string, number> = {};
  private limit = 2;

  allowedToAdd(placement: string): boolean {
    const count = this.counter[placement] ?? 0;

    if (count >= this.limit) {
      return false;
    }

    this.counter[placement] = count + 1;
    return true;
  }
}
