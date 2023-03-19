import type { AppPluginExtensionLink } from '@grafana/data';

import { createLinkValidator } from './validateLink';

describe('extension link validator', () => {
  const pluginId = 'grafana-basic-app';
  const validator = createLinkValidator({
    pluginId,
    title: 'Link to something',
    logger: jest.fn(),
  });

  const context = {};
  const extension: AppPluginExtensionLink = {
    title: 'Go to page one',
    description: 'Will navigate the user to page one',
    path: `/a/${pluginId}/one`,
  };

  it('should return link configuration if path is valid', () => {
    const configureWithValidation = validator(() => {
      return {
        path: `/a/${pluginId}/other`,
      };
    });

    const configured = configureWithValidation(extension, context);
    expect(configured).toEqual({
      path: `/a/${pluginId}/other`,
    });
  });

  it('should return link configuration if path is not specified', () => {
    const configureWithValidation = validator(() => {
      return {
        title: 'Go to page two',
      };
    });

    const configured = configureWithValidation(extension, context);
    expect(configured).toEqual({ title: 'Go to page two' });
  });

  it('should return undefined if path is invalid', () => {
    const configureWithValidation = validator(() => {
      return {
        path: `/other`,
      };
    });

    const configured = configureWithValidation(extension, context);
    expect(configured).toBeUndefined();
  });

  it('should return undefined if undefined is returned from inner configure', () => {
    const configureWithValidation = validator(() => {
      return undefined;
    });

    const configured = configureWithValidation(extension, context);
    expect(configured).toBeUndefined();
  });
});
