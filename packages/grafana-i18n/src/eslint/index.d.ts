// Type definitions are intentionally minimal to avoid "Named exports" errors with attw.
// The plugin exports a CommonJS module that cannot be properly typed with full fidelity
// without causing TypeScript to advertise named exports that don't exist at runtime
// when imported from ESM under node16 module resolution.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const plugin: any;
export = plugin;
