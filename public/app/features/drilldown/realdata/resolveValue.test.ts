import { resolveValue } from './resolveValue';

const namespaces = (...names: string[]) => jest.fn().mockResolvedValue(names);

describe('resolveValue', () => {
  it('takes the value that equals the service name, even when prefixed values exist', async () => {
    const namespacesOf = namespaces('grafana');

    const value = await resolveValue('checkout', ['grafana/checkout', 'checkout'], namespacesOf);

    expect(value).toBe('checkout');
    expect(namespacesOf).not.toHaveBeenCalled();
  });

  it('takes a namespace and name value when Tempo lists the namespace for the service', async () => {
    expect(await resolveValue('checkout', ['shop/checkout', 'billing'], namespaces('shop'))).toBe('shop/checkout');
  });

  it('asks for nothing when no value ends with the service name', async () => {
    const namespacesOf = namespaces('shop');

    expect(await resolveValue('checkout', ['billing', 'shop/cart'], namespacesOf)).toBeUndefined();
    expect(namespacesOf).not.toHaveBeenCalled();
  });

  it('leaves out a value whose namespace Tempo does not list for the service', async () => {
    expect(await resolveValue('querier', ['loki/querier', 'mimir/querier'], namespaces('mimir'))).toBe('mimir/querier');
    expect(await resolveValue('querier', ['loki/querier'], namespaces('mimir'))).toBeUndefined();
  });

  it('finds nothing when Tempo lists no namespace for the service', async () => {
    expect(await resolveValue('checkout', ['shop/checkout'], namespaces())).toBeUndefined();
  });

  it('drops the eBPF value when an SDK value exists', async () => {
    const values = ['ebpf/shop/checkout', 'shop/checkout'];

    expect(await resolveValue('checkout', values, namespaces('shop'))).toBe('shop/checkout');
  });

  it('keeps an eBPF value that stands alone, and reads its namespace after the prefix', async () => {
    expect(await resolveValue('checkout', ['ebpf/shop/checkout'], namespaces('shop'))).toBe('ebpf/shop/checkout');
    expect(await resolveValue('checkout', ['ebpf/shop/checkout'], namespaces('ebpf'))).toBeUndefined();
  });

  it('takes the first listed value in the data source order when several remain', async () => {
    const values = ['b-shop/checkout', 'a-shop/checkout'];

    expect(await resolveValue('checkout', values, namespaces('a-shop', 'b-shop'))).toBe('b-shop/checkout');
  });

  it('reads a service name with regular expression characters as plain text', async () => {
    expect(await resolveValue('a.b', ['shop/a.b', 'shop/axb'], namespaces('shop'))).toBe('shop/a.b');
  });
});
