export * from './endpoints.gen';
import { enhancedApi as generatedAPI } from './endpoints.gen';

export const cloudMigrationAPI = generatedAPI.enhanceEndpoints({
  addTagTypes: ['cloud-migration-config', 'cloud-migration-run'],
  endpoints: {
    // List Cloud Configs
    getMigrationList: {
      providesTags: ['cloud-migration-config'] /* should this be a -list? */,
    },

    // Create Cloud Config
    createMigration: {
      invalidatesTags: ['cloud-migration-config'],
    },

    // Get one Cloud Config
    getCloudMigration: {
      providesTags: ['cloud-migration-config'],
    },

    // Delete one Cloud Config
    deleteCloudMigration: {
      invalidatesTags: ['cloud-migration-config'],
    },

    getCloudMigrationRunList: {
      providesTags: ['cloud-migration-run'] /* should this be a -list? */,
    },

    getCloudMigrationRun: {
      providesTags: ['cloud-migration-run'],
    },

    runCloudMigration: {
      invalidatesTags: ['cloud-migration-run'],
    },
  },
});
