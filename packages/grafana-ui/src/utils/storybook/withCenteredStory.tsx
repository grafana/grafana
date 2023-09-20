import { DecoratorFn } from '@storybook/react';

/** @deprecated Stories should not be centered on the page. This decorator now does nothing */
export const withNotCenteredStory: DecoratorFn = (story) => story();

/** @deprecated Stories should not be centered on the page. This decorator now does nothing */
export const withCenteredStory: DecoratorFn = (story) => story();

/** @deprecated Stories should not be centered on the page. This decorator now does nothing */
export const withHorizontallyCenteredStory: DecoratorFn = (story) => story();

/** @deprecated Stories should not be centered on the page. This decorator now does nothing */
export const withVerticallyCenteredStory: DecoratorFn = (story) => story();
