import { ResourceList, Resource } from '../../../../../public/app/features/apiserver/types';

export interface GenericContactPoint {
  uid: string;
  title: string;
  description?: string;
}

export interface ContactPointAdapter<ActualApiContactPointType> {
  /** Hook to fetch the list of raw contact points from the specific API version */
  useListContactPoints: () => {
    currentData?: ResourceList<ActualApiContactPointType>;
    isLoading: boolean;
    error?: unknown;
  };

  /** Transforms an API-specific contact point to the GenericContactPoint structure */
  toGenericContactPoint: (apiCp: Resource<ActualApiContactPointType>) => GenericContactPoint;
}
