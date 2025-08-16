import { t } from '@grafana/i18n';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';

class ValidationError extends Error {
  type: string;

  constructor(type: string, message: string) {
    super(message);
    this.type = type;
  }
}

export class ValidationSrv {
  rootName = 'general';

  validateNewDashboardName(folderUID: string, name: string) {
    return this.validate(
      folderUID,
      name,
      t(
        'manage-dashboards.validation-srv.message-same-name',
        'A dashboard or a folder with the same name already exists'
      )
    );
  }

  validateNewFolderName(name?: string, parentFolderUid?: string) {
    const validationMessage = parentFolderUid
      ? t(
          'manage-dashboards.validation-srv.message-same-name-current-folder',
          'A dashboard or a folder with the same name already exists in the current folder'
        )
      : t(
          'manage-dashboards.validation-srv.message-same-name-general',
          'A folder or dashboard with the same name already exists in the root folder'
        );

    return this.validate(parentFolderUid || this.rootName, name, validationMessage);
  }

  private async validate(
    /** Folder in which to validate newly created resource */
    folderUID: string,
    /** Name of the resource being created */
    name: string | undefined,
    /** Error message to throw if the resource already exists */
    existingErrorMessage: string
  ) {
    name = (name || '').trim();
    const nameLowerCased = name.toLowerCase();

    if (name.length === 0) {
      throw new ValidationError(
        'REQUIRED',
        t('manage-dashboards.validation-srv.message-name-required', 'Name is required')
      );
    }

    if (nameLowerCased === this.rootName) {
      throw new ValidationError(
        'EXISTING',
        t(
          'manage-dashboards.validation-srv.message-reserved-name',
          'This is a reserved name and cannot be used for a folder.'
        )
      );
    }

    const searcher = getGrafanaSearcher();

    const dashboardResults = await searcher.search({
      kind: ['dashboard', 'folder'],
      query: name,
      location: folderUID || 'general',
    });

    for (const result of dashboardResults.view) {
      if (nameLowerCased === result.name.toLowerCase()) {
        throw new ValidationError('EXISTING', existingErrorMessage);
      }
    }

    return;
  }
}

export const validationSrv = new ValidationSrv();
