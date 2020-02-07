# Guidelines for code comments in grafana-* packages

## Table of Contents

1. [Package description](#package-description)
1. [Stability of APIs](#stability-of-apis)
1. [Deprecation of APIs](#deprecation-of-apis)
1. [Examples for reference](#examples)
____

 ## Package description

Each package will have an overview explaining the overall responsibility and usage of the package. 

This can be documented with the [`@packageDocumentation`](https://api-extractor.com/pages/tsdoc/tag_packagedocumentation/) tag.

**Do:**

Add this tag to the `<packageRoot>/src/index.ts` entry file to have one place for the package description.

## Stability of APIs

All `exported` apis from the package should have a release tag to indicate its stability.

- [`@alpha`](https://api-extractor.com/pages/tsdoc/tag_alpha/) - early draft of api and will probably change.
- [`@beta`](https://api-extractor.com/pages/tsdoc/tag_beta/) - close to being stable but might change.
- [`@public`](https://api-extractor.com/pages/tsdoc/tag_public/) - ready to use in production.
- [`@internal`](https://api-extractor.com/pages/tsdoc/tag_internal/) - for internal use only.

### Main stability of APIs

Add a tag to mark the stability of the whole exported `class/interface/function/type` etc.

Please place the `release tag` at the bottom of the comment to make it consistent among files and easier to read. 

**Do:**

```typescript
/**
 * Will help to create DataFrame objects and handle 
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
    create(): DataFrame { }
}
```

**Don't**
```typescript
/**
 * Will help to create DataFrame objects and handle 
 * the heavy lifting of creating a complex object.
 * 
 * @public
 * @example
 * ```typescript
 * const dataFrame = factory.create();
 * ```
 **/
export class DataFrameFactory {
    create(): DataFrame { }
}
```

### Partial stability of APIs

Add the main stability of the API at the top according to [Main stability of API](#main-stability-of-api).

Then override the non-stable parts of the API with the proper [release tag](#release-tags). This should also be place at the bottom of the comment block.

**Do:**

```typescript
/**
 * Will help to create DataFrame objects and handle 
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
    create(): DataFrame { }

    /**
     * @beta
     **/
    createMany(): DataFrames[] {}
}
```

**Don't**

```typescript
/**
 * Will help to create DataFrame objects and handle 
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
    create(): DataFrame { }

    /**
     * @beta
     **/
    createMany(): DataFrame[] {}
}
```

## Deprecation of APIs
If you want to mark an API as deprecated to signal that this API will be removed in the future. You can easily do this by adding the [`@deprecated`](https://api-extractor.com/pages/tsdoc/tag_deprecated/) tag.

If applicable add a reason why the API is deprecated directly after the `@deprecated tag`

### Deprecate the whole API

Add the [`@deprecated`](https://api-extractor.com/pages/tsdoc/tag_deprecated/) tag directly above the `release tag`.

**Do:**
```typescript
/**
 * Will help to create DataFrame objects and handle 
 * the heavy lifting of creating a complex object.
 * 
 * @example
 * ```typescript
 * const dataFrame = factory.create();
 * ```
 * @deprecated DataFrame object is replaced by DataFrameView so please use the DataFrameViewFactory instead.
 * @public
 **/
export class DataFrameFactory {
    create(): DataFrame { }
    createMany(): DataFrame[] {}
}
```

**Don't:**
```typescript
/**
 * Will help to create DataFrame objects and handle 
 * the heavy lifting of creating a complex object.
 * 
 * @example
 * ```typescript
 * const dataFrame = factory.create();
 * ```
 * @public
 * @deprecated DataFrame object is replaced by DataFrameView so please use the DataFrameViewFactory instead.
 **/
export class DataFrameFactory {
    create(): DataFrame { }
    createMany(): DataFrame[] {}
}
```

### Deprecate parts of the API

Add the [`@deprecated`](https://api-extractor.com/pages/tsdoc/tag_deprecated/) tag directly above the `release tag` if applicable otherwise add it at the bottom of the comment.

**Do:**
```typescript
/**
 * Will help to create DataFrame objects and handle 
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
    create(): DataFrame { }

    /**
     * Creates multiple `DataFrame` objects
     * 
     * @deprecated
     **/
    createMany(): DataFrame[] {}
}
```