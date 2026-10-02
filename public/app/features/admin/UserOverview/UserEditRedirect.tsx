import { Navigate, useLocation, useParams } from 'react-router-dom-v5-compat';

export default function UserEditRedirect() {
  const { id = '' } = useParams();
  const { search } = useLocation();
  return <Navigate replace to={`/admin/users/${id}${search}`} />;
}
