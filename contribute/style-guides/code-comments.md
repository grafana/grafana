# Guidelines for code comments in Grafana packages

This guide provides recommendations for adding code comments in `grafana-\*` packages.

## Add package description

Each package has an overview explaining the overall responsibility and usage of the package.

Use the [`@packageDocumentation`](https://api-extractor.com/pages/tsdoc/tag_packagedocumentation/) tag to document the package.

Add the `@packageDocumentation` tag to the `<packageRoot>/src/index.ts` entry file to have one place for the package description.

## Set stability of an API

Add a release tag to all exported APIs from the package to indicate its stability.

- [`@alpha`](https://api-extractor.com/pages/tsdoc/tag_alpha/) - denotes an early draft of API that will probably change.
- [`@beta`](https://api-extractor.com/pages/tsdoc/tag_beta/) - denotes that the API is close to being stable but might change.
- [`@public`](https://api-extractor.com/pages/tsdoc/tag_public/) - denotes that the API is ready for usage in production.
- [`@internal`](https://api-extractor.com/pages/tsdoc/tag_internal/) - denotes that the API is for internal use only.

### Indicate main stability of APIs

To indicate the main stability of APIs:

- Add a tag to mark the stability of the whole exported `class/interface/function/type`, and other interfaces.
- Place the release tag at the bottom of the comment to make it consistent among files and easier to read.

**Do:**

````typescript
/**
 * Helps to create DataFrame objects and handle
 * the heavy lifting of creating a complex object.
 *
 * @example
 * ```typescript
 * const dataFrame = factory.create();
 * ```
 *
 * @public
 **/
export class DataFrameFactory {
  create(): DataFrame {}
}
````

**Don't:**

````typescript
/**
 * Helps to create DataFrame objects and handle
 * the heavy lifting of creating a complex object.
 *
 * @public
 * @example
 * ```typescript
 * const dataFrame = factory.create();
 * ```
 **/
export class DataFrameFactory {
  create(): DataFrame {}
}
````

### Indicate partial stability of APIs

To indicate the partial stability of APIs:

1. Add the main stability of the API at the top according to [Main stability of API](#indicate-main-stability-of-apis).
1. Override the non-stable parts of the API with the proper release tag. This tag should also be placed at the bottom of the comment block.

**Do:**

````typescript
/**
 * Helps to create DataFrame objects and handle
 * the heavy lifting of creating a complex object.
 *
 * @example
 * ```typescript
 * const dataFrame = factory.create();
 * ```
 *
 * @public
 **/
export class DataFrameFactory {
  create(): DataFrame {}

  /**
   * @beta
   **/
  createMany(): DataFrames[] {}
}
````

**Don't:**

````typescript
/**
 * Helps to create DataFrame objects and handle
 * the heavy lifting of creating a complex object.
 *
 * @example
 * ```typescript
 * const dataFrame = factory.create();
 * ```
 **/
export class DataFrameFactory {
  /**
   * @public
   **/
  create(): DataFrame {}

  /**
   * @beta
   **/
  createMany(): DataFrame[] {}
}
````

## Deprecate an API

If you want to mark an API as deprecated to signal that this API will be removed in the future, then add the [`@deprecated`](https://api-extractor.com/pages/tsdoc/tag_deprecated/) tag.

If applicable, add a reason why the API is deprecated directly after the `@deprecated tag`.

## Specify parameters

If you want to specify the possible parameters that can be passed to an API, then add the [`@param`](https://api-extractor.com/pages/tsdoc/tag_param/) tag.

This attribute can be skipped if the type provided by `typescript` and the function comment or the function name is enough to explain what the parameters are.

**Do:**

```typescript
/**
 * Helps to create a resource resolver depending
 * on the current execution context.
 *
 * @param context - The current execution context.
 * @returns FileResolver if executed on the server otherwise a HttpResolver.
 * @public
 **/
export const factory = (context: Context): IResolver => {
  if (context.isServer) {
    return new FileResolver();
  }
  return new HttpResolver();
};
```

**Don't**

```typescript
/**
 * Compares two numbers to see if they are equal to each other.
 *
 * @param x - The first number
 * @param y - The second number
 * @public
 **/
export const isEqual = (x: number, y: number): boolean => {
  return x === y;
};
```

## Set return values

To specify the return value from a function, you can use the [`@returns`](https://api-extractor.com/pages/tsdoc/tag_returns/) tag.

You can skip this attribute if the type provided by `typescript` and the function comment or the function name is enough to explain what the function returns.

**Do:**

```typescript
/**
 * Helps to create a resource resolver depending
 * on the current execution context.
 *
 * @param context - The current execution context.
 * @returns FileResolver if executed on the server otherwise a HttpResolver.
 * @public
 **/
export const factory = (context: Context): IResolver => {
  if (context.isServer) {
    return new FileResolver();
  }
  return new HttpResolver();
};
```

**Don't:**

```typescript
/**
 * Compares two numbers to see if they are equal to each other.
 *
 * @returns true if values are equal
 * @public
 **/
export const isEqual = (x: number, y: number): boolean => {
  return x === y;
};
```
