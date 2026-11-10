import { getSharedVariablesEntryPoint, registerSharedVariablesEntryPoint } from './SharedVariablesEntryPointExtension';

describe('SharedVariablesEntryPointExtension', () => {
  afterEach(() => {
    registerSharedVariablesEntryPoint(null);
  });

  it('returns null until Enterprise registers a component', () => {
    expect(getSharedVariablesEntryPoint()).toBeNull();
  });

  it('returns the registered component', () => {
    const Stub = () => null;
    registerSharedVariablesEntryPoint(Stub);
    expect(getSharedVariablesEntryPoint()).toBe(Stub);
  });
});
