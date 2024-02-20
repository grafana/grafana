interface TypeMeta {
  apiVersion: string;
  kind: string;
}

interface ObjectMeta {
  namespace: string;
  name: string;
  resourceVersion: string;
  creationTimestamp: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

interface Resource<T = object> extends TypeMeta {
  metadata: ObjectMeta;
  spec: T;
}

interface ResourceWithStatus<T = object, S = object> extends TypeMeta {
  metadata: ObjectMeta;
  spec: T;
  status: S;
}

interface ResourceForCreate<T = any> extends Partial<TypeMeta> {
  metadata: Partial<ObjectMeta>;
  spec: T;
}

interface ListMeta {
  resourceVersion: string;
  continue?: string;
  remainingItemCount?: number;
}

interface ResourceList<T> extends TypeMeta {
  metadata: ListMeta;
  items: Array<Resource<T>>;
}

interface PlaylistSpec {
  title: string;
}

interface Playlist extends Resource<PlaylistSpec> {
  kind: 'Playlist';
}
