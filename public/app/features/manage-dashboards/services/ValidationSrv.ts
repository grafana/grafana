import { getGrafanaSearcher } from 'app/features/search/service';

class ValidationError extends Error {
  type: string;

  constructor(type: string, message: string) {
    super(message);
    this.type = type;
  }
}

export class ValidationSrv {
  rootName = 'general';

  validateNewDashboardName(folderUid: any, name: string) {
    return this.validate(folderUid, name, 'A dashboard or a folder with the same name already exists');
  }

  validateNewFolderName(name?: string) {
    return this.validate(0, name, 'A folder or dashboard in the general folder with the same name already exists');
  }

  private async validate(folderId: any, name: string | undefined, existingErrorMessage: string) {
    name = (name || '').trim();
    const nameLowerCased = name.toLowerCase();

    if (name.length === 0) {
      throw new ValidationError('REQUIRED', 'Name is required');
    }

    if (folderId === 0 && nameLowerCased === this.rootName) {
      throw new ValidationError('EXISTING', 'This is a reserved name and cannot be used for a folder.');
    }

    const searcher = getGrafanaSearcher();

    const dashboardResults = await searcher.search({
      kind: ['dashboard'],
      query: name,
      location: folderId || 'general',
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
