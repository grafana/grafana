Code needed on the Postgres database holding Unified Storage tables:

```SQL
create or replace function tgf_notify_entity() returns trigger as $BODY$
declare
	json_key_names text[] := array['guid', 'group', 'name', 'resource', 'resource_version', 'folder', 'labels'];
	channel text;
	payload text;
begin
	if (TG_OP = 'DELETE') then
		channel := old.namespace;
		payload := json_object(json_key_names, array[old.guid::text, old.group::text, old.name::text, old.resource::text, old.resource_version::text, old.folder::text, COALESCE(old.labels, '')::text])::text;
	else
		channel := new.namespace;
		payload := json_object(json_key_names, array[new.guid::text, new.group::text, new.name::text, new.resource::text, new.resource_version::text, new.folder::text, COALESCE(new.labels, '')::text])::text;
	end if;

	perform pg_notify(channel, payload);

	if (TG_OP = 'DELETE') then
		return old;
	else
		return new;
	end if;
end
$BODY$ language plpgsql;

create trigger tg_notify_entity after insert or update or delete on entity for each row execute function tgf_notify_entity();
```
