/** Expected constant response from `/api/search/sorting` */
export const SORT_OPTIONS = {
  sortOptions: [
    {
      description: 'Sort results in an alphabetically ascending order',
      displayName: 'Alphabetically (A–Z)',
      meta: '',
      name: 'alpha-asc',
    },
    {
      description: 'Sort results in an alphabetically descending order',
      displayName: 'Alphabetically (Z–A)',
      meta: '',
      name: 'alpha-desc',
    },
    {
      description: 'Sort results based on recent errors in descending order',
      displayName: 'Errors 30 days (most)',
      meta: 'errors',
      name: 'errors-recently-desc',
    },
    {
      description: 'Sort results based on recent errors in ascending order',
      displayName: 'Errors 30 days (least)',
      meta: 'errors',
      name: 'errors-recently-asc',
    },
    {
      description: 'Sort results based on errors in descending order',
      displayName: 'Errors total (most)',
      meta: 'errors',
      name: 'errors-desc',
    },
    {
      description: 'Sort results based on errors in ascending order',
      displayName: 'Errors total (least)',
      meta: 'errors',
      name: 'errors-asc',
    },
    {
      description: 'Sort results based on recent views in descending order',
      displayName: 'Views 30 days (most)',
      meta: 'views',
      name: 'viewed-recently-desc',
    },
    {
      description: 'Sort results based on recent views in ascending order',
      displayName: 'Views 30 days (least)',
      meta: 'views',
      name: 'viewed-recently-asc',
    },
    {
      description: 'Sort results based on views in descending order',
      displayName: 'Views total (most)',
      meta: 'views',
      name: 'viewed-desc',
    },
    {
      description: 'Sort results based on views in ascending order',
      displayName: 'Views total (least)',
      meta: 'views',
      name: 'viewed-asc',
    },
  ],
};
