--
-- PostgreSQL database dump
--

-- Dumped from database version 12.2 (Debian 12.2-2.pgdg100+1)
-- Dumped by pg_dump version 12.2 (Debian 12.2-2.pgdg100+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_event_entity; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.admin_event_entity (
    id character varying(36) NOT NULL,
    admin_event_time bigint,
    realm_id character varying(255),
    operation_type character varying(255),
    auth_realm_id character varying(255),
    auth_client_id character varying(255),
    auth_user_id character varying(255),
    ip_address character varying(255),
    resource_path character varying(2550),
    representation text,
    error character varying(255),
    resource_type character varying(64)
);


ALTER TABLE public.admin_event_entity OWNER TO keycloak;

--
-- Name: associated_policy; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.associated_policy (
    policy_id character varying(36) NOT NULL,
    associated_policy_id character varying(36) NOT NULL
);


ALTER TABLE public.associated_policy OWNER TO keycloak;

--
-- Name: authentication_execution; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.authentication_execution (
    id character varying(36) NOT NULL,
    alias character varying(255),
    authenticator character varying(36),
    realm_id character varying(36),
    flow_id character varying(36),
    requirement integer,
    priority integer,
    authenticator_flow boolean DEFAULT false NOT NULL,
    auth_flow_id character varying(36),
    auth_config character varying(36)
);


ALTER TABLE public.authentication_execution OWNER TO keycloak;

--
-- Name: authentication_flow; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.authentication_flow (
    id character varying(36) NOT NULL,
    alias character varying(255),
    description character varying(255),
    realm_id character varying(36),
    provider_id character varying(36) DEFAULT 'basic-flow'::character varying NOT NULL,
    top_level boolean DEFAULT false NOT NULL,
    built_in boolean DEFAULT false NOT NULL
);


ALTER TABLE public.authentication_flow OWNER TO keycloak;

--
-- Name: authenticator_config; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.authenticator_config (
    id character varying(36) NOT NULL,
    alias character varying(255),
    realm_id character varying(36)
);


ALTER TABLE public.authenticator_config OWNER TO keycloak;

--
-- Name: authenticator_config_entry; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.authenticator_config_entry (
    authenticator_id character varying(36) NOT NULL,
    value text,
    name character varying(255) NOT NULL
);


ALTER TABLE public.authenticator_config_entry OWNER TO keycloak;

--
-- Name: broker_link; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.broker_link (
    identity_provider character varying(255) NOT NULL,
    storage_provider_id character varying(255),
    realm_id character varying(36) NOT NULL,
    broker_user_id character varying(255),
    broker_username character varying(255),
    token text,
    user_id character varying(255) NOT NULL
);


ALTER TABLE public.broker_link OWNER TO keycloak;

--
-- Name: client; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.client (
    id character varying(36) NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    full_scope_allowed boolean DEFAULT false NOT NULL,
    client_id character varying(255),
    not_before integer,
    public_client boolean DEFAULT false NOT NULL,
    secret character varying(255),
    base_url character varying(255),
    bearer_only boolean DEFAULT false NOT NULL,
    management_url character varying(255),
    surrogate_auth_required boolean DEFAULT false NOT NULL,
    realm_id character varying(36),
    protocol character varying(255),
    node_rereg_timeout integer DEFAULT 0,
    frontchannel_logout boolean DEFAULT false NOT NULL,
    consent_required boolean DEFAULT false NOT NULL,
    name character varying(255),
    service_accounts_enabled boolean DEFAULT false NOT NULL,
    client_authenticator_type character varying(255),
    root_url character varying(255),
    description character varying(255),
    registration_token character varying(255),
    standard_flow_enabled boolean DEFAULT true NOT NULL,
    implicit_flow_enabled boolean DEFAULT false NOT NULL,
    direct_access_grants_enabled boolean DEFAULT false NOT NULL,
    always_display_in_console boolean DEFAULT false NOT NULL
);


ALTER TABLE public.client OWNER TO keycloak;

--
-- Name: client_attributes; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.client_attributes (
    client_id character varying(36) NOT NULL,
    value character varying(4000),
    name character varying(255) NOT NULL
);


ALTER TABLE public.client_attributes OWNER TO keycloak;

--
-- Name: client_auth_flow_bindings; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.client_auth_flow_bindings (
    client_id character varying(36) NOT NULL,
    flow_id character varying(36),
    binding_name character varying(255) NOT NULL
);


ALTER TABLE public.client_auth_flow_bindings OWNER TO keycloak;

--
-- Name: client_default_roles; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.client_default_roles (
    client_id character varying(36) NOT NULL,
    role_id character varying(36) NOT NULL
);


ALTER TABLE public.client_default_roles OWNER TO keycloak;

--
-- Name: client_initial_access; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.client_initial_access (
    id character varying(36) NOT NULL,
    realm_id character varying(36) NOT NULL,
    "timestamp" integer,
    expiration integer,
    count integer,
    remaining_count integer
);


ALTER TABLE public.client_initial_access OWNER TO keycloak;

--
-- Name: client_node_registrations; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.client_node_registrations (
    client_id character varying(36) NOT NULL,
    value integer,
    name character varying(255) NOT NULL
);


ALTER TABLE public.client_node_registrations OWNER TO keycloak;

--
-- Name: client_scope; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.client_scope (
    id character varying(36) NOT NULL,
    name character varying(255),
    realm_id character varying(36),
    description character varying(255),
    protocol character varying(255)
);


ALTER TABLE public.client_scope OWNER TO keycloak;

--
-- Name: client_scope_attributes; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.client_scope_attributes (
    scope_id character varying(36) NOT NULL,
    value character varying(2048),
    name character varying(255) NOT NULL
);


ALTER TABLE public.client_scope_attributes OWNER TO keycloak;

--
-- Name: client_scope_client; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.client_scope_client (
    client_id character varying(36) NOT NULL,
    scope_id character varying(36) NOT NULL,
    default_scope boolean DEFAULT false NOT NULL
);


ALTER TABLE public.client_scope_client OWNER TO keycloak;

--
-- Name: client_scope_role_mapping; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.client_scope_role_mapping (
    scope_id character varying(36) NOT NULL,
    role_id character varying(36) NOT NULL
);


ALTER TABLE public.client_scope_role_mapping OWNER TO keycloak;

--
-- Name: client_session; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.client_session (
    id character varying(36) NOT NULL,
    client_id character varying(36),
    redirect_uri character varying(255),
    state character varying(255),
    "timestamp" integer,
    session_id character varying(36),
    auth_method character varying(255),
    realm_id character varying(255),
    auth_user_id character varying(36),
    current_action character varying(36)
);


ALTER TABLE public.client_session OWNER TO keycloak;

--
-- Name: client_session_auth_status; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.client_session_auth_status (
    authenticator character varying(36) NOT NULL,
    status integer,
    client_session character varying(36) NOT NULL
);


ALTER TABLE public.client_session_auth_status OWNER TO keycloak;

--
-- Name: client_session_note; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.client_session_note (
    name character varying(255) NOT NULL,
    value character varying(255),
    client_session character varying(36) NOT NULL
);


ALTER TABLE public.client_session_note OWNER TO keycloak;

--
-- Name: client_session_prot_mapper; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.client_session_prot_mapper (
    protocol_mapper_id character varying(36) NOT NULL,
    client_session character varying(36) NOT NULL
);


ALTER TABLE public.client_session_prot_mapper OWNER TO keycloak;

--
-- Name: client_session_role; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.client_session_role (
    role_id character varying(255) NOT NULL,
    client_session character varying(36) NOT NULL
);


ALTER TABLE public.client_session_role OWNER TO keycloak;

--
-- Name: client_user_session_note; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.client_user_session_note (
    name character varying(255) NOT NULL,
    value character varying(2048),
    client_session character varying(36) NOT NULL
);


ALTER TABLE public.client_user_session_note OWNER TO keycloak;

--
-- Name: component; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.component (
    id character varying(36) NOT NULL,
    name character varying(255),
    parent_id character varying(36),
    provider_id character varying(36),
    provider_type character varying(255),
    realm_id character varying(36),
    sub_type character varying(255)
);


ALTER TABLE public.component OWNER TO keycloak;

--
-- Name: component_config; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.component_config (
    id character varying(36) NOT NULL,
    component_id character varying(36) NOT NULL,
    name character varying(255) NOT NULL,
    value character varying(4000)
);


ALTER TABLE public.component_config OWNER TO keycloak;

--
-- Name: composite_role; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.composite_role (
    composite character varying(36) NOT NULL,
    child_role character varying(36) NOT NULL
);


ALTER TABLE public.composite_role OWNER TO keycloak;

--
-- Name: credential; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.credential (
    id character varying(36) NOT NULL,
    salt bytea,
    type character varying(255),
    user_id character varying(36),
    created_date bigint,
    user_label character varying(255),
    secret_data text,
    credential_data text,
    priority integer
);


ALTER TABLE public.credential OWNER TO keycloak;

--
-- Name: databasechangelog; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.databasechangelog (
    id character varying(255) NOT NULL,
    author character varying(255) NOT NULL,
    filename character varying(255) NOT NULL,
    dateexecuted timestamp without time zone NOT NULL,
    orderexecuted integer NOT NULL,
    exectype character varying(10) NOT NULL,
    md5sum character varying(35),
    description character varying(255),
    comments character varying(255),
    tag character varying(255),
    liquibase character varying(20),
    contexts character varying(255),
    labels character varying(255),
    deployment_id character varying(10)
);


ALTER TABLE public.databasechangelog OWNER TO keycloak;

--
-- Name: databasechangeloglock; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.databasechangeloglock (
    id integer NOT NULL,
    locked boolean NOT NULL,
    lockgranted timestamp without time zone,
    lockedby character varying(255)
);


ALTER TABLE public.databasechangeloglock OWNER TO keycloak;

--
-- Name: default_client_scope; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.default_client_scope (
    realm_id character varying(36) NOT NULL,
    scope_id character varying(36) NOT NULL,
    default_scope boolean DEFAULT false NOT NULL
);


ALTER TABLE public.default_client_scope OWNER TO keycloak;

--
-- Name: event_entity; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.event_entity (
    id character varying(36) NOT NULL,
    client_id character varying(255),
    details_json character varying(2550),
    error character varying(255),
    ip_address character varying(255),
    realm_id character varying(255),
    session_id character varying(255),
    event_time bigint,
    type character varying(255),
    user_id character varying(255)
);


ALTER TABLE public.event_entity OWNER TO keycloak;

--
-- Name: fed_user_attribute; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.fed_user_attribute (
    id character varying(36) NOT NULL,
    name character varying(255) NOT NULL,
    user_id character varying(255) NOT NULL,
    realm_id character varying(36) NOT NULL,
    storage_provider_id character varying(36),
    value character varying(2024)
);


ALTER TABLE public.fed_user_attribute OWNER TO keycloak;

--
-- Name: fed_user_consent; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.fed_user_consent (
    id character varying(36) NOT NULL,
    client_id character varying(255),
    user_id character varying(255) NOT NULL,
    realm_id character varying(36) NOT NULL,
    storage_provider_id character varying(36),
    created_date bigint,
    last_updated_date bigint,
    client_storage_provider character varying(36),
    external_client_id character varying(255)
);


ALTER TABLE public.fed_user_consent OWNER TO keycloak;

--
-- Name: fed_user_consent_cl_scope; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.fed_user_consent_cl_scope (
    user_consent_id character varying(36) NOT NULL,
    scope_id character varying(36) NOT NULL
);


ALTER TABLE public.fed_user_consent_cl_scope OWNER TO keycloak;

--
-- Name: fed_user_credential; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.fed_user_credential (
    id character varying(36) NOT NULL,
    salt bytea,
    type character varying(255),
    created_date bigint,
    user_id character varying(255) NOT NULL,
    realm_id character varying(36) NOT NULL,
    storage_provider_id character varying(36),
    user_label character varying(255),
    secret_data text,
    credential_data text,
    priority integer
);


ALTER TABLE public.fed_user_credential OWNER TO keycloak;

--
-- Name: fed_user_group_membership; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.fed_user_group_membership (
    group_id character varying(36) NOT NULL,
    user_id character varying(255) NOT NULL,
    realm_id character varying(36) NOT NULL,
    storage_provider_id character varying(36)
);


ALTER TABLE public.fed_user_group_membership OWNER TO keycloak;

--
-- Name: fed_user_required_action; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.fed_user_required_action (
    required_action character varying(255) DEFAULT ' '::character varying NOT NULL,
    user_id character varying(255) NOT NULL,
    realm_id character varying(36) NOT NULL,
    storage_provider_id character varying(36)
);


ALTER TABLE public.fed_user_required_action OWNER TO keycloak;

--
-- Name: fed_user_role_mapping; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.fed_user_role_mapping (
    role_id character varying(36) NOT NULL,
    user_id character varying(255) NOT NULL,
    realm_id character varying(36) NOT NULL,
    storage_provider_id character varying(36)
);


ALTER TABLE public.fed_user_role_mapping OWNER TO keycloak;

--
-- Name: federated_identity; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.federated_identity (
    identity_provider character varying(255) NOT NULL,
    realm_id character varying(36),
    federated_user_id character varying(255),
    federated_username character varying(255),
    token text,
    user_id character varying(36) NOT NULL
);


ALTER TABLE public.federated_identity OWNER TO keycloak;

--
-- Name: federated_user; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.federated_user (
    id character varying(255) NOT NULL,
    storage_provider_id character varying(255),
    realm_id character varying(36) NOT NULL
);


ALTER TABLE public.federated_user OWNER TO keycloak;

--
-- Name: group_attribute; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.group_attribute (
    id character varying(36) DEFAULT 'sybase-needs-something-here'::character varying NOT NULL,
    name character varying(255) NOT NULL,
    value character varying(255),
    group_id character varying(36) NOT NULL
);


ALTER TABLE public.group_attribute OWNER TO keycloak;

--
-- Name: group_role_mapping; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.group_role_mapping (
    role_id character varying(36) NOT NULL,
    group_id character varying(36) NOT NULL
);


ALTER TABLE public.group_role_mapping OWNER TO keycloak;

--
-- Name: identity_provider; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.identity_provider (
    internal_id character varying(36) NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    provider_alias character varying(255),
    provider_id character varying(255),
    store_token boolean DEFAULT false NOT NULL,
    authenticate_by_default boolean DEFAULT false NOT NULL,
    realm_id character varying(36),
    add_token_role boolean DEFAULT true NOT NULL,
    trust_email boolean DEFAULT false NOT NULL,
    first_broker_login_flow_id character varying(36),
    post_broker_login_flow_id character varying(36),
    provider_display_name character varying(255),
    link_only boolean DEFAULT false NOT NULL
);


ALTER TABLE public.identity_provider OWNER TO keycloak;

--
-- Name: identity_provider_config; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.identity_provider_config (
    identity_provider_id character varying(36) NOT NULL,
    value text,
    name character varying(255) NOT NULL
);


ALTER TABLE public.identity_provider_config OWNER TO keycloak;

--
-- Name: identity_provider_mapper; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.identity_provider_mapper (
    id character varying(36) NOT NULL,
    name character varying(255) NOT NULL,
    idp_alias character varying(255) NOT NULL,
    idp_mapper_name character varying(255) NOT NULL,
    realm_id character varying(36) NOT NULL
);


ALTER TABLE public.identity_provider_mapper OWNER TO keycloak;

--
-- Name: idp_mapper_config; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.idp_mapper_config (
    idp_mapper_id character varying(36) NOT NULL,
    value text,
    name character varying(255) NOT NULL
);


ALTER TABLE public.idp_mapper_config OWNER TO keycloak;

--
-- Name: keycloak_group; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.keycloak_group (
    id character varying(36) NOT NULL,
    name character varying(255),
    parent_group character varying(36) NOT NULL,
    realm_id character varying(36)
);


ALTER TABLE public.keycloak_group OWNER TO keycloak;

--
-- Name: keycloak_role; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.keycloak_role (
    id character varying(36) NOT NULL,
    client_realm_constraint character varying(255),
    client_role boolean DEFAULT false NOT NULL,
    description character varying(255),
    name character varying(255),
    realm_id character varying(255),
    client character varying(36),
    realm character varying(36)
);


ALTER TABLE public.keycloak_role OWNER TO keycloak;

--
-- Name: migration_model; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.migration_model (
    id character varying(36) NOT NULL,
    version character varying(36),
    update_time bigint DEFAULT 0 NOT NULL
);


ALTER TABLE public.migration_model OWNER TO keycloak;

--
-- Name: offline_client_session; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.offline_client_session (
    user_session_id character varying(36) NOT NULL,
    client_id character varying(255) NOT NULL,
    offline_flag character varying(4) NOT NULL,
    "timestamp" integer,
    data text,
    client_storage_provider character varying(36) DEFAULT 'local'::character varying NOT NULL,
    external_client_id character varying(255) DEFAULT 'local'::character varying NOT NULL
);


ALTER TABLE public.offline_client_session OWNER TO keycloak;

--
-- Name: offline_user_session; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.offline_user_session (
    user_session_id character varying(36) NOT NULL,
    user_id character varying(255) NOT NULL,
    realm_id character varying(36) NOT NULL,
    created_on integer NOT NULL,
    offline_flag character varying(4) NOT NULL,
    data text,
    last_session_refresh integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.offline_user_session OWNER TO keycloak;

--
-- Name: policy_config; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.policy_config (
    policy_id character varying(36) NOT NULL,
    name character varying(255) NOT NULL,
    value text
);


ALTER TABLE public.policy_config OWNER TO keycloak;

--
-- Name: protocol_mapper; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.protocol_mapper (
    id character varying(36) NOT NULL,
    name character varying(255) NOT NULL,
    protocol character varying(255) NOT NULL,
    protocol_mapper_name character varying(255) NOT NULL,
    client_id character varying(36),
    client_scope_id character varying(36)
);


ALTER TABLE public.protocol_mapper OWNER TO keycloak;

--
-- Name: protocol_mapper_config; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.protocol_mapper_config (
    protocol_mapper_id character varying(36) NOT NULL,
    value text,
    name character varying(255) NOT NULL
);


ALTER TABLE public.protocol_mapper_config OWNER TO keycloak;

--
-- Name: realm; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.realm (
    id character varying(36) NOT NULL,
    access_code_lifespan integer,
    user_action_lifespan integer,
    access_token_lifespan integer,
    account_theme character varying(255),
    admin_theme character varying(255),
    email_theme character varying(255),
    enabled boolean DEFAULT false NOT NULL,
    events_enabled boolean DEFAULT false NOT NULL,
    events_expiration bigint,
    login_theme character varying(255),
    name character varying(255),
    not_before integer,
    password_policy character varying(2550),
    registration_allowed boolean DEFAULT false NOT NULL,
    remember_me boolean DEFAULT false NOT NULL,
    reset_password_allowed boolean DEFAULT false NOT NULL,
    social boolean DEFAULT false NOT NULL,
    ssl_required character varying(255),
    sso_idle_timeout integer,
    sso_max_lifespan integer,
    update_profile_on_soc_login boolean DEFAULT false NOT NULL,
    verify_email boolean DEFAULT false NOT NULL,
    master_admin_client character varying(36),
    login_lifespan integer,
    internationalization_enabled boolean DEFAULT false NOT NULL,
    default_locale character varying(255),
    reg_email_as_username boolean DEFAULT false NOT NULL,
    admin_events_enabled boolean DEFAULT false NOT NULL,
    admin_events_details_enabled boolean DEFAULT false NOT NULL,
    edit_username_allowed boolean DEFAULT false NOT NULL,
    otp_policy_counter integer DEFAULT 0,
    otp_policy_window integer DEFAULT 1,
    otp_policy_period integer DEFAULT 30,
    otp_policy_digits integer DEFAULT 6,
    otp_policy_alg character varying(36) DEFAULT 'HmacSHA1'::character varying,
    otp_policy_type character varying(36) DEFAULT 'totp'::character varying,
    browser_flow character varying(36),
    registration_flow character varying(36),
    direct_grant_flow character varying(36),
    reset_credentials_flow character varying(36),
    client_auth_flow character varying(36),
    offline_session_idle_timeout integer DEFAULT 0,
    revoke_refresh_token boolean DEFAULT false NOT NULL,
    access_token_life_implicit integer DEFAULT 0,
    login_with_email_allowed boolean DEFAULT true NOT NULL,
    duplicate_emails_allowed boolean DEFAULT false NOT NULL,
    docker_auth_flow character varying(36),
    refresh_token_max_reuse integer DEFAULT 0,
    allow_user_managed_access boolean DEFAULT false NOT NULL,
    sso_max_lifespan_remember_me integer DEFAULT 0 NOT NULL,
    sso_idle_timeout_remember_me integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.realm OWNER TO keycloak;

--
-- Name: realm_attribute; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.realm_attribute (
    name character varying(255) NOT NULL,
    value character varying(255),
    realm_id character varying(36) NOT NULL
);


ALTER TABLE public.realm_attribute OWNER TO keycloak;

--
-- Name: realm_default_groups; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.realm_default_groups (
    realm_id character varying(36) NOT NULL,
    group_id character varying(36) NOT NULL
);


ALTER TABLE public.realm_default_groups OWNER TO keycloak;

--
-- Name: realm_default_roles; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.realm_default_roles (
    realm_id character varying(36) NOT NULL,
    role_id character varying(36) NOT NULL
);


ALTER TABLE public.realm_default_roles OWNER TO keycloak;

--
-- Name: realm_enabled_event_types; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.realm_enabled_event_types (
    realm_id character varying(36) NOT NULL,
    value character varying(255) NOT NULL
);


ALTER TABLE public.realm_enabled_event_types OWNER TO keycloak;

--
-- Name: realm_events_listeners; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.realm_events_listeners (
    realm_id character varying(36) NOT NULL,
    value character varying(255) NOT NULL
);


ALTER TABLE public.realm_events_listeners OWNER TO keycloak;

--
-- Name: realm_localizations; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.realm_localizations (
    realm_id character varying(255) NOT NULL,
    locale character varying(255) NOT NULL,
    texts text NOT NULL
);


ALTER TABLE public.realm_localizations OWNER TO keycloak;

--
-- Name: realm_required_credential; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.realm_required_credential (
    type character varying(255) NOT NULL,
    form_label character varying(255),
    input boolean DEFAULT false NOT NULL,
    secret boolean DEFAULT false NOT NULL,
    realm_id character varying(36) NOT NULL
);


ALTER TABLE public.realm_required_credential OWNER TO keycloak;

--
-- Name: realm_smtp_config; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.realm_smtp_config (
    realm_id character varying(36) NOT NULL,
    value character varying(255),
    name character varying(255) NOT NULL
);


ALTER TABLE public.realm_smtp_config OWNER TO keycloak;

--
-- Name: realm_supported_locales; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.realm_supported_locales (
    realm_id character varying(36) NOT NULL,
    value character varying(255) NOT NULL
);


ALTER TABLE public.realm_supported_locales OWNER TO keycloak;

--
-- Name: redirect_uris; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.redirect_uris (
    client_id character varying(36) NOT NULL,
    value character varying(255) NOT NULL
);


ALTER TABLE public.redirect_uris OWNER TO keycloak;

--
-- Name: required_action_config; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.required_action_config (
    required_action_id character varying(36) NOT NULL,
    value text,
    name character varying(255) NOT NULL
);


ALTER TABLE public.required_action_config OWNER TO keycloak;

--
-- Name: required_action_provider; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.required_action_provider (
    id character varying(36) NOT NULL,
    alias character varying(255),
    name character varying(255),
    realm_id character varying(36),
    enabled boolean DEFAULT false NOT NULL,
    default_action boolean DEFAULT false NOT NULL,
    provider_id character varying(255),
    priority integer
);


ALTER TABLE public.required_action_provider OWNER TO keycloak;

--
-- Name: resource_attribute; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.resource_attribute (
    id character varying(36) DEFAULT 'sybase-needs-something-here'::character varying NOT NULL,
    name character varying(255) NOT NULL,
    value character varying(255),
    resource_id character varying(36) NOT NULL
);


ALTER TABLE public.resource_attribute OWNER TO keycloak;

--
-- Name: resource_policy; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.resource_policy (
    resource_id character varying(36) NOT NULL,
    policy_id character varying(36) NOT NULL
);


ALTER TABLE public.resource_policy OWNER TO keycloak;

--
-- Name: resource_scope; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.resource_scope (
    resource_id character varying(36) NOT NULL,
    scope_id character varying(36) NOT NULL
);


ALTER TABLE public.resource_scope OWNER TO keycloak;

--
-- Name: resource_server; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.resource_server (
    id character varying(36) NOT NULL,
    allow_rs_remote_mgmt boolean DEFAULT false NOT NULL,
    policy_enforce_mode character varying(15) NOT NULL,
    decision_strategy smallint DEFAULT 1 NOT NULL
);


ALTER TABLE public.resource_server OWNER TO keycloak;

--
-- Name: resource_server_perm_ticket; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.resource_server_perm_ticket (
    id character varying(36) NOT NULL,
    owner character varying(255) NOT NULL,
    requester character varying(255) NOT NULL,
    created_timestamp bigint NOT NULL,
    granted_timestamp bigint,
    resource_id character varying(36) NOT NULL,
    scope_id character varying(36),
    resource_server_id character varying(36) NOT NULL,
    policy_id character varying(36)
);


ALTER TABLE public.resource_server_perm_ticket OWNER TO keycloak;

--
-- Name: resource_server_policy; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.resource_server_policy (
    id character varying(36) NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(255),
    type character varying(255) NOT NULL,
    decision_strategy character varying(20),
    logic character varying(20),
    resource_server_id character varying(36) NOT NULL,
    owner character varying(255)
);


ALTER TABLE public.resource_server_policy OWNER TO keycloak;

--
-- Name: resource_server_resource; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.resource_server_resource (
    id character varying(36) NOT NULL,
    name character varying(255) NOT NULL,
    type character varying(255),
    icon_uri character varying(255),
    owner character varying(255) NOT NULL,
    resource_server_id character varying(36) NOT NULL,
    owner_managed_access boolean DEFAULT false NOT NULL,
    display_name character varying(255)
);


ALTER TABLE public.resource_server_resource OWNER TO keycloak;

--
-- Name: resource_server_scope; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.resource_server_scope (
    id character varying(36) NOT NULL,
    name character varying(255) NOT NULL,
    icon_uri character varying(255),
    resource_server_id character varying(36) NOT NULL,
    display_name character varying(255)
);


ALTER TABLE public.resource_server_scope OWNER TO keycloak;

--
-- Name: resource_uris; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.resource_uris (
    resource_id character varying(36) NOT NULL,
    value character varying(255) NOT NULL
);


ALTER TABLE public.resource_uris OWNER TO keycloak;

--
-- Name: role_attribute; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.role_attribute (
    id character varying(36) NOT NULL,
    role_id character varying(36) NOT NULL,
    name character varying(255) NOT NULL,
    value character varying(255)
);


ALTER TABLE public.role_attribute OWNER TO keycloak;

--
-- Name: scope_mapping; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.scope_mapping (
    client_id character varying(36) NOT NULL,
    role_id character varying(36) NOT NULL
);


ALTER TABLE public.scope_mapping OWNER TO keycloak;

--
-- Name: scope_policy; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.scope_policy (
    scope_id character varying(36) NOT NULL,
    policy_id character varying(36) NOT NULL
);


ALTER TABLE public.scope_policy OWNER TO keycloak;

--
-- Name: user_attribute; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.user_attribute (
    name character varying(255) NOT NULL,
    value character varying(255),
    user_id character varying(36) NOT NULL,
    id character varying(36) DEFAULT 'sybase-needs-something-here'::character varying NOT NULL
);


ALTER TABLE public.user_attribute OWNER TO keycloak;

--
-- Name: user_consent; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.user_consent (
    id character varying(36) NOT NULL,
    client_id character varying(255),
    user_id character varying(36) NOT NULL,
    created_date bigint,
    last_updated_date bigint,
    client_storage_provider character varying(36),
    external_client_id character varying(255)
);


ALTER TABLE public.user_consent OWNER TO keycloak;

--
-- Name: user_consent_client_scope; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.user_consent_client_scope (
    user_consent_id character varying(36) NOT NULL,
    scope_id character varying(36) NOT NULL
);


ALTER TABLE public.user_consent_client_scope OWNER TO keycloak;

--
-- Name: user_entity; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.user_entity (
    id character varying(36) NOT NULL,
    email character varying(255),
    email_constraint character varying(255),
    email_verified boolean DEFAULT false NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    federation_link character varying(255),
    first_name character varying(255),
    last_name character varying(255),
    realm_id character varying(255),
    username character varying(255),
    created_timestamp bigint,
    service_account_client_link character varying(255),
    not_before integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.user_entity OWNER TO keycloak;

--
-- Name: user_federation_config; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.user_federation_config (
    user_federation_provider_id character varying(36) NOT NULL,
    value character varying(255),
    name character varying(255) NOT NULL
);


ALTER TABLE public.user_federation_config OWNER TO keycloak;

--
-- Name: user_federation_mapper; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.user_federation_mapper (
    id character varying(36) NOT NULL,
    name character varying(255) NOT NULL,
    federation_provider_id character varying(36) NOT NULL,
    federation_mapper_type character varying(255) NOT NULL,
    realm_id character varying(36) NOT NULL
);


ALTER TABLE public.user_federation_mapper OWNER TO keycloak;

--
-- Name: user_federation_mapper_config; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.user_federation_mapper_config (
    user_federation_mapper_id character varying(36) NOT NULL,
    value character varying(255),
    name character varying(255) NOT NULL
);


ALTER TABLE public.user_federation_mapper_config OWNER TO keycloak;

--
-- Name: user_federation_provider; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.user_federation_provider (
    id character varying(36) NOT NULL,
    changed_sync_period integer,
    display_name character varying(255),
    full_sync_period integer,
    last_sync integer,
    priority integer,
    provider_name character varying(255),
    realm_id character varying(36)
);


ALTER TABLE public.user_federation_provider OWNER TO keycloak;

--
-- Name: user_group_membership; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.user_group_membership (
    group_id character varying(36) NOT NULL,
    user_id character varying(36) NOT NULL
);


ALTER TABLE public.user_group_membership OWNER TO keycloak;

--
-- Name: user_required_action; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.user_required_action (
    user_id character varying(36) NOT NULL,
    required_action character varying(255) DEFAULT ' '::character varying NOT NULL
);


ALTER TABLE public.user_required_action OWNER TO keycloak;

--
-- Name: user_role_mapping; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.user_role_mapping (
    role_id character varying(255) NOT NULL,
    user_id character varying(36) NOT NULL
);


ALTER TABLE public.user_role_mapping OWNER TO keycloak;

--
-- Name: user_session; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.user_session (
    id character varying(36) NOT NULL,
    auth_method character varying(255),
    ip_address character varying(255),
    last_session_refresh integer,
    login_username character varying(255),
    realm_id character varying(255),
    remember_me boolean DEFAULT false NOT NULL,
    started integer,
    user_id character varying(255),
    user_session_state integer,
    broker_session_id character varying(255),
    broker_user_id character varying(255)
);


ALTER TABLE public.user_session OWNER TO keycloak;

--
-- Name: user_session_note; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.user_session_note (
    user_session character varying(36) NOT NULL,
    name character varying(255) NOT NULL,
    value character varying(2048)
);


ALTER TABLE public.user_session_note OWNER TO keycloak;

--
-- Name: username_login_failure; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.username_login_failure (
    realm_id character varying(36) NOT NULL,
    username character varying(255) NOT NULL,
    failed_login_not_before integer,
    last_failure bigint,
    last_ip_failure character varying(255),
    num_failures integer
);


ALTER TABLE public.username_login_failure OWNER TO keycloak;

--
-- Name: web_origins; Type: TABLE; Schema: public; Owner: keycloak
--

CREATE TABLE public.web_origins (
    client_id character varying(36) NOT NULL,
    value character varying(255) NOT NULL
);


ALTER TABLE public.web_origins OWNER TO keycloak;

--
-- Data for Name: admin_event_entity; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.admin_event_entity (id, admin_event_time, realm_id, operation_type, auth_realm_id, auth_client_id, auth_user_id, ip_address, resource_path, representation, error, resource_type) FROM stdin;
\.


--
-- Data for Name: associated_policy; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.associated_policy (policy_id, associated_policy_id) FROM stdin;
\.


--
-- Data for Name: authentication_execution; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.authentication_execution (id, alias, authenticator, realm_id, flow_id, requirement, priority, authenticator_flow, auth_flow_id, auth_config) FROM stdin;
a3eef0c8-a14f-4d33-b4ee-d9eba1e14350	\N	auth-cookie	master	ef998ef5-ca12-45db-a252-2e71b1419039	2	10	f	\N	\N
c4489997-ee7b-4649-845e-70b79d3cd49f	\N	auth-spnego	master	ef998ef5-ca12-45db-a252-2e71b1419039	3	20	f	\N	\N
6ae8f57d-d882-4e46-ad47-1e634302f979	\N	identity-provider-redirector	master	ef998ef5-ca12-45db-a252-2e71b1419039	2	25	f	\N	\N
8478e3a6-1659-47a9-b7eb-503148adec2d	\N	\N	master	ef998ef5-ca12-45db-a252-2e71b1419039	2	30	t	4e407b0a-c011-4aef-bcf5-e8c5e649493e	\N
da80fc4b-ebb0-4ef8-8594-8ba7a03506b9	\N	auth-username-password-form	master	4e407b0a-c011-4aef-bcf5-e8c5e649493e	0	10	f	\N	\N
c54d81b7-e944-4b9d-9657-b01ee5bff6a4	\N	\N	master	4e407b0a-c011-4aef-bcf5-e8c5e649493e	1	20	t	8561a6a9-da18-4977-a92d-2c85763d042a	\N
e57dc48f-3217-4401-a8dc-4d386396525a	\N	conditional-user-configured	master	8561a6a9-da18-4977-a92d-2c85763d042a	0	10	f	\N	\N
69a60f10-cc10-4604-890a-59fe4eb255b7	\N	auth-otp-form	master	8561a6a9-da18-4977-a92d-2c85763d042a	0	20	f	\N	\N
96dbd0ee-fcc4-4e27-85ac-a89bee432892	\N	direct-grant-validate-username	master	5f6f801e-0588-4a6e-860a-35483f5c1ec7	0	10	f	\N	\N
bfbcc1e9-f129-4336-a0cd-b6960a811bd9	\N	direct-grant-validate-password	master	5f6f801e-0588-4a6e-860a-35483f5c1ec7	0	20	f	\N	\N
079621e7-6daf-4df0-b3d3-97a3b53cdec1	\N	\N	master	5f6f801e-0588-4a6e-860a-35483f5c1ec7	1	30	t	99865746-4232-46f0-84b5-20952fe9eb51	\N
511afd6e-e447-4877-8fe9-c54c938e70a6	\N	conditional-user-configured	master	99865746-4232-46f0-84b5-20952fe9eb51	0	10	f	\N	\N
5a2470c4-3136-4cf0-8383-e74a413ccd48	\N	direct-grant-validate-otp	master	99865746-4232-46f0-84b5-20952fe9eb51	0	20	f	\N	\N
47c96943-ad68-4d93-afff-ff54fc86eb0b	\N	registration-page-form	master	1695e7d2-ad80-4502-8479-8121a6e2a2f0	0	10	t	8fb96669-d28d-4173-a8f4-dc24d41c7d27	\N
a6678624-1bd4-4793-bfac-68551cf0ac7c	\N	registration-user-creation	master	8fb96669-d28d-4173-a8f4-dc24d41c7d27	0	20	f	\N	\N
5b45827d-5dfd-4152-a99e-373cb975ef87	\N	registration-profile-action	master	8fb96669-d28d-4173-a8f4-dc24d41c7d27	0	40	f	\N	\N
5a2fb70d-63ae-4604-b37c-ae043d6a900d	\N	registration-password-action	master	8fb96669-d28d-4173-a8f4-dc24d41c7d27	0	50	f	\N	\N
0b06a30e-daa7-498a-9fdb-899abbf36450	\N	registration-recaptcha-action	master	8fb96669-d28d-4173-a8f4-dc24d41c7d27	3	60	f	\N	\N
b6ab0b5d-8184-4609-bb81-da8413dfb858	\N	reset-credentials-choose-user	master	954b046d-2b24-405e-84ee-c44ffe603df2	0	10	f	\N	\N
300fb529-aee1-416d-803c-ca24e01af5a0	\N	reset-credential-email	master	954b046d-2b24-405e-84ee-c44ffe603df2	0	20	f	\N	\N
de127e3d-11fa-4ddb-bd33-86ed8006be63	\N	reset-password	master	954b046d-2b24-405e-84ee-c44ffe603df2	0	30	f	\N	\N
9d819c31-4238-4b6f-9318-95e1826d4a4c	\N	\N	master	954b046d-2b24-405e-84ee-c44ffe603df2	1	40	t	b379b44c-beef-4065-882c-d04cf6d4ffc8	\N
65875994-0342-452e-b7ad-547a9092e302	\N	conditional-user-configured	master	b379b44c-beef-4065-882c-d04cf6d4ffc8	0	10	f	\N	\N
0f202e0b-da55-43a5-95a6-a38cfeb97529	\N	reset-otp	master	b379b44c-beef-4065-882c-d04cf6d4ffc8	0	20	f	\N	\N
988c39a0-4c44-4090-bdfd-4b5a8060e822	\N	client-secret	master	023dc515-c259-42bb-88a8-2e8d84abca92	2	10	f	\N	\N
cd4e6875-71cf-436c-bf3f-5f5ac4402627	\N	client-jwt	master	023dc515-c259-42bb-88a8-2e8d84abca92	2	20	f	\N	\N
fac88bab-1ea5-4617-bbda-d187cba68a45	\N	client-secret-jwt	master	023dc515-c259-42bb-88a8-2e8d84abca92	2	30	f	\N	\N
d19571b1-5eeb-44d4-8866-273da4b34850	\N	client-x509	master	023dc515-c259-42bb-88a8-2e8d84abca92	2	40	f	\N	\N
4198a01d-d3cd-49b2-8e8a-f506f2c46fc1	\N	idp-review-profile	master	242efff2-c3b7-42c0-a48a-77bb1b54502a	0	10	f	\N	8ab33625-af83-4fcd-aa77-6bd365100d7b
d9b78c97-27b0-4eef-8d54-6143ca48cffd	\N	\N	master	242efff2-c3b7-42c0-a48a-77bb1b54502a	0	20	t	d46ab605-5f1e-4649-88bf-6c2dc79d636d	\N
2a3faef7-dc89-4cf2-b299-d754a15af259	\N	idp-create-user-if-unique	master	d46ab605-5f1e-4649-88bf-6c2dc79d636d	2	10	f	\N	c7d1ba52-6053-4219-8118-a64cebfab1e1
12c7ff48-2eec-4091-920f-6a1ad3d2d3ad	\N	\N	master	d46ab605-5f1e-4649-88bf-6c2dc79d636d	2	20	t	c39b0bc2-aba3-414d-ad3e-b648708e24d1	\N
015a4d49-de8a-4cb0-b5c5-1868c30085d3	\N	idp-confirm-link	master	c39b0bc2-aba3-414d-ad3e-b648708e24d1	0	10	f	\N	\N
0bfffcda-f282-4370-b55f-1b44519be4da	\N	\N	master	c39b0bc2-aba3-414d-ad3e-b648708e24d1	0	20	t	a7ca6b5a-fa8a-4f4a-bafa-ae178db785a3	\N
8e0d10d1-47ff-4998-a26b-882ed2b71ab4	\N	idp-email-verification	master	a7ca6b5a-fa8a-4f4a-bafa-ae178db785a3	2	10	f	\N	\N
6a396600-1b18-472c-b755-ad36857abf68	\N	\N	master	a7ca6b5a-fa8a-4f4a-bafa-ae178db785a3	2	20	t	ca3a3600-552c-4849-9a9d-826c8aa3e646	\N
d600bb67-e258-44be-8f69-f1bae9c35a0f	\N	idp-username-password-form	master	ca3a3600-552c-4849-9a9d-826c8aa3e646	0	10	f	\N	\N
638e46e8-cf88-4dfa-911d-5659854dd390	\N	\N	master	ca3a3600-552c-4849-9a9d-826c8aa3e646	1	20	t	a7d23655-efbb-4950-8ab6-50dbc85681a0	\N
61fc6720-91ff-4ba3-880b-9d0a22deb7dc	\N	conditional-user-configured	master	a7d23655-efbb-4950-8ab6-50dbc85681a0	0	10	f	\N	\N
90cc39a9-cddb-49bd-b9f5-d64d03341333	\N	auth-otp-form	master	a7d23655-efbb-4950-8ab6-50dbc85681a0	0	20	f	\N	\N
b0634301-594e-42db-9736-6c90ebbeb8b2	\N	http-basic-authenticator	master	57c56583-d91c-4399-bd15-05a1a17d48c1	0	10	f	\N	\N
34fa4d44-716b-4b2a-b98e-aa9748154292	\N	docker-http-basic-authenticator	master	032b05cf-0007-44da-a370-b42039f6b762	0	10	f	\N	\N
4838277a-46ea-4d95-bd86-d8dc6fdce352	\N	no-cookie-redirect	master	1c7af06b-3085-46c3-849c-34c67f581b9e	0	10	f	\N	\N
59a349ee-20ce-42d8-b20b-8f902c09742d	\N	\N	master	1c7af06b-3085-46c3-849c-34c67f581b9e	0	20	t	85c00992-77dd-4262-8744-a9dd8521e98e	\N
d9b5fa46-6595-4406-9841-2c0720dbf644	\N	basic-auth	master	85c00992-77dd-4262-8744-a9dd8521e98e	0	10	f	\N	\N
3a4ee6f1-1528-47c7-aeda-f317248b3b93	\N	basic-auth-otp	master	85c00992-77dd-4262-8744-a9dd8521e98e	3	20	f	\N	\N
014847fc-06df-4ddf-a8f2-deeb0f1eb59a	\N	auth-spnego	master	85c00992-77dd-4262-8744-a9dd8521e98e	3	30	f	\N	\N
b46bc4f6-2fe5-44d5-b47f-36880742cf50	\N	auth-cookie	grafana	a38aeb47-f27e-4e68-82ff-7cc7371a47a7	2	10	f	\N	\N
6cec48cc-066a-4e3e-8158-85351bfa4c27	\N	auth-spnego	grafana	a38aeb47-f27e-4e68-82ff-7cc7371a47a7	3	20	f	\N	\N
63c55c5a-ad11-4f83-9d6e-d8ca2efcaf66	\N	identity-provider-redirector	grafana	a38aeb47-f27e-4e68-82ff-7cc7371a47a7	2	25	f	\N	\N
9a986c59-e016-45e2-8eb6-77ccdd0fd0f5	\N	\N	grafana	a38aeb47-f27e-4e68-82ff-7cc7371a47a7	2	30	t	c53e357f-e276-43aa-b36c-46366a7ffd35	\N
85672b45-ebc9-40e8-a579-fbf5c4e2de9f	\N	auth-username-password-form	grafana	c53e357f-e276-43aa-b36c-46366a7ffd35	0	10	f	\N	\N
09025e52-b379-4457-8ab4-74a2426a7139	\N	\N	grafana	c53e357f-e276-43aa-b36c-46366a7ffd35	1	20	t	cf4831e9-3e1d-452e-984e-e6d4d9eeafb5	\N
64d5c6d6-1dde-4c42-b502-1abdf939e55b	\N	conditional-user-configured	grafana	cf4831e9-3e1d-452e-984e-e6d4d9eeafb5	0	10	f	\N	\N
4b782423-ec3d-4e88-8fcf-fa12b4a34fc3	\N	auth-otp-form	grafana	cf4831e9-3e1d-452e-984e-e6d4d9eeafb5	0	20	f	\N	\N
07052e96-64b2-41b5-95fc-e3ac6abcc577	\N	direct-grant-validate-username	grafana	b478ecfb-db7e-4797-a245-8fc3b4dec884	0	10	f	\N	\N
10c22bdd-d243-44be-810f-d2fedbb973e1	\N	direct-grant-validate-password	grafana	b478ecfb-db7e-4797-a245-8fc3b4dec884	0	20	f	\N	\N
6a6273e9-146c-4b4e-b7ce-42ed72cbc03f	\N	conditional-user-configured	grafana	b3491338-0630-4232-97e7-a518c254b248	0	10	f	\N	\N
d87abeef-9f1d-46f5-9f36-acd7eaf21a72	\N	direct-grant-validate-otp	grafana	b3491338-0630-4232-97e7-a518c254b248	0	20	f	\N	\N
4f204bab-0311-44b4-80b6-37d23fd0fd5a	\N	registration-page-form	grafana	9d02badd-cb1c-4655-bf5e-f888861433ff	0	10	t	c3ed2ad1-cfb4-49fa-8c75-cf5047527c68	\N
2d4ee446-623c-42a0-8d4a-9f6c4f7f28ec	\N	registration-user-creation	grafana	c3ed2ad1-cfb4-49fa-8c75-cf5047527c68	0	20	f	\N	\N
d806effc-dd17-4468-9a98-4e1c2f9e799d	\N	registration-profile-action	grafana	c3ed2ad1-cfb4-49fa-8c75-cf5047527c68	0	40	f	\N	\N
306fa749-c191-43c6-bf04-0eb6d3d02732	\N	registration-password-action	grafana	c3ed2ad1-cfb4-49fa-8c75-cf5047527c68	0	50	f	\N	\N
7de9bbee-eb3d-4f3e-a134-e7e8d4a6df25	\N	registration-recaptcha-action	grafana	c3ed2ad1-cfb4-49fa-8c75-cf5047527c68	3	60	f	\N	\N
8a31d18e-1622-4eac-8eff-9434fa9cade3	\N	reset-credentials-choose-user	grafana	3085fb68-fc1f-4e1c-a8be-33fb45194b04	0	10	f	\N	\N
6006359c-b678-4526-90de-3dcfb3200868	\N	reset-credential-email	grafana	3085fb68-fc1f-4e1c-a8be-33fb45194b04	0	20	f	\N	\N
e74add33-2692-4c20-8605-cc98c1901b98	\N	reset-password	grafana	3085fb68-fc1f-4e1c-a8be-33fb45194b04	0	30	f	\N	\N
52942b96-3bf2-47e7-9863-a917f6df716c	\N	\N	grafana	3085fb68-fc1f-4e1c-a8be-33fb45194b04	1	40	t	079166ff-6d61-4bb2-a26d-374b8558f628	\N
bc646947-4121-4d38-96b1-a8ed4b534cc7	\N	conditional-user-configured	grafana	079166ff-6d61-4bb2-a26d-374b8558f628	0	10	f	\N	\N
efd9bb77-2d97-4ec0-9653-cd8fef30b307	\N	reset-otp	grafana	079166ff-6d61-4bb2-a26d-374b8558f628	0	20	f	\N	\N
0bdc0916-5d84-4ac8-8cc9-0235cfb18262	\N	client-secret	grafana	cbb4b3ca-ced6-4046-8b59-f1c3959c7948	2	10	f	\N	\N
919f02c4-745b-43f6-a50f-5bdc9792f017	\N	client-jwt	grafana	cbb4b3ca-ced6-4046-8b59-f1c3959c7948	2	20	f	\N	\N
84e716ef-c5b6-4c8e-b4ca-acaa35b6e2a0	\N	client-secret-jwt	grafana	cbb4b3ca-ced6-4046-8b59-f1c3959c7948	2	30	f	\N	\N
1da09fa3-1b81-4e97-bbd5-e5b5baccb73b	\N	client-x509	grafana	cbb4b3ca-ced6-4046-8b59-f1c3959c7948	2	40	f	\N	\N
f707b2f6-05b1-4cc8-8eaf-ed7006975583	\N	idp-review-profile	grafana	0af1201c-a206-4393-9528-cb6083b9caa0	0	10	f	\N	e159a12b-cd0b-4241-a41c-e13f84e92052
9762f956-a74f-40c7-b0a3-52a699892652	\N	\N	grafana	0af1201c-a206-4393-9528-cb6083b9caa0	0	20	t	df86516c-dcb1-41a8-877e-eb8805bcac8c	\N
186e5f38-1a9f-4fa2-bc61-749118e4f76b	\N	idp-create-user-if-unique	grafana	df86516c-dcb1-41a8-877e-eb8805bcac8c	2	10	f	\N	f159d9c3-3ea7-460d-a719-b9c88bcbf650
1b08ecd3-fc9f-4f17-bfa1-5bf0cc482d47	\N	\N	grafana	df86516c-dcb1-41a8-877e-eb8805bcac8c	2	20	t	9947a1b3-c26c-423f-b380-deadb5dce1ad	\N
3fa35527-e92c-4159-a80d-98412291f023	\N	idp-confirm-link	grafana	9947a1b3-c26c-423f-b380-deadb5dce1ad	0	10	f	\N	\N
ce94d52f-caf6-4388-a9e0-ac00870a8c6b	\N	\N	grafana	9947a1b3-c26c-423f-b380-deadb5dce1ad	0	20	t	3c15ac69-f452-49ab-94d6-92e6bf809ebc	\N
4a901e36-7af7-406a-a274-ac39a7bc5c8f	\N	idp-email-verification	grafana	3c15ac69-f452-49ab-94d6-92e6bf809ebc	2	10	f	\N	\N
5ff95eb9-2f72-42ea-92da-7bd11a7bc4f8	\N	\N	grafana	3c15ac69-f452-49ab-94d6-92e6bf809ebc	2	20	t	1075a862-7836-4d28-a191-8be19a6574cf	\N
72dbe3c2-0648-493f-a1e4-4b8fd6fc73ea	\N	idp-username-password-form	grafana	1075a862-7836-4d28-a191-8be19a6574cf	0	10	f	\N	\N
e42d20ac-5167-4048-8658-3ebe3e7b9a70	\N	\N	grafana	1075a862-7836-4d28-a191-8be19a6574cf	1	20	t	21fbd70a-286f-431a-abc4-fbf6590fcdc3	\N
b8ce6905-73eb-493b-9ce1-408ec55e3c46	\N	conditional-user-configured	grafana	21fbd70a-286f-431a-abc4-fbf6590fcdc3	0	10	f	\N	\N
54d7692d-c0e3-40ef-9ef9-d9e8227d618d	\N	auth-otp-form	grafana	21fbd70a-286f-431a-abc4-fbf6590fcdc3	0	20	f	\N	\N
3722f24d-6ffb-4b20-a481-1fd8a17afdf6	\N	http-basic-authenticator	grafana	ba53abf5-9a64-4371-810b-67378eb3d781	0	10	f	\N	\N
a700b05f-a61d-4eeb-ad75-1a3df05ed429	\N	docker-http-basic-authenticator	grafana	95e02703-f5bc-4e04-8bef-f6adc2d8173f	0	10	f	\N	\N
035c4f94-03a6-4101-a729-f3c01ee4c490	\N	no-cookie-redirect	grafana	f397495e-d073-4ef1-babf-569a338db596	0	10	f	\N	\N
29f310db-b302-44b2-9182-4b91648cbabf	\N	\N	grafana	f397495e-d073-4ef1-babf-569a338db596	0	20	t	56c40f89-4d69-46fd-bb18-d6c01808d2af	\N
4e7d257c-e013-4597-a44d-b186a85606af	\N	basic-auth	grafana	56c40f89-4d69-46fd-bb18-d6c01808d2af	0	10	f	\N	\N
2ba05817-a59f-4e72-a565-f3b4591390dc	\N	basic-auth-otp	grafana	56c40f89-4d69-46fd-bb18-d6c01808d2af	3	20	f	\N	\N
5db9c781-6718-4674-a833-9a4ac3e8212e	\N	auth-spnego	grafana	56c40f89-4d69-46fd-bb18-d6c01808d2af	3	30	f	\N	\N
5f032dbb-bd37-425b-af1e-ba555c7a8245	\N	\N	grafana	b478ecfb-db7e-4797-a245-8fc3b4dec884	1	30	t	b3491338-0630-4232-97e7-a518c254b248	\N
\.


--
-- Data for Name: authentication_flow; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.authentication_flow (id, alias, description, realm_id, provider_id, top_level, built_in) FROM stdin;
ef998ef5-ca12-45db-a252-2e71b1419039	browser	browser based authentication	master	basic-flow	t	t
4e407b0a-c011-4aef-bcf5-e8c5e649493e	forms	Username, password, otp and other auth forms.	master	basic-flow	f	t
8561a6a9-da18-4977-a92d-2c85763d042a	Browser - Conditional OTP	Flow to determine if the OTP is required for the authentication	master	basic-flow	f	t
5f6f801e-0588-4a6e-860a-35483f5c1ec7	direct grant	OpenID Connect Resource Owner Grant	master	basic-flow	t	t
99865746-4232-46f0-84b5-20952fe9eb51	Direct Grant - Conditional OTP	Flow to determine if the OTP is required for the authentication	master	basic-flow	f	t
1695e7d2-ad80-4502-8479-8121a6e2a2f0	registration	registration flow	master	basic-flow	t	t
8fb96669-d28d-4173-a8f4-dc24d41c7d27	registration form	registration form	master	form-flow	f	t
954b046d-2b24-405e-84ee-c44ffe603df2	reset credentials	Reset credentials for a user if they forgot their password or something	master	basic-flow	t	t
b379b44c-beef-4065-882c-d04cf6d4ffc8	Reset - Conditional OTP	Flow to determine if the OTP should be reset or not. Set to REQUIRED to force.	master	basic-flow	f	t
023dc515-c259-42bb-88a8-2e8d84abca92	clients	Base authentication for clients	master	client-flow	t	t
242efff2-c3b7-42c0-a48a-77bb1b54502a	first broker login	Actions taken after first broker login with identity provider account, which is not yet linked to any Keycloak account	master	basic-flow	t	t
d46ab605-5f1e-4649-88bf-6c2dc79d636d	User creation or linking	Flow for the existing/non-existing user alternatives	master	basic-flow	f	t
c39b0bc2-aba3-414d-ad3e-b648708e24d1	Handle Existing Account	Handle what to do if there is existing account with same email/username like authenticated identity provider	master	basic-flow	f	t
a7ca6b5a-fa8a-4f4a-bafa-ae178db785a3	Account verification options	Method with which to verity the existing account	master	basic-flow	f	t
ca3a3600-552c-4849-9a9d-826c8aa3e646	Verify Existing Account by Re-authentication	Reauthentication of existing account	master	basic-flow	f	t
a7d23655-efbb-4950-8ab6-50dbc85681a0	First broker login - Conditional OTP	Flow to determine if the OTP is required for the authentication	master	basic-flow	f	t
57c56583-d91c-4399-bd15-05a1a17d48c1	saml ecp	SAML ECP Profile Authentication Flow	master	basic-flow	t	t
032b05cf-0007-44da-a370-b42039f6b762	docker auth	Used by Docker clients to authenticate against the IDP	master	basic-flow	t	t
1c7af06b-3085-46c3-849c-34c67f581b9e	http challenge	An authentication flow based on challenge-response HTTP Authentication Schemes	master	basic-flow	t	t
85c00992-77dd-4262-8744-a9dd8521e98e	Authentication Options	Authentication options.	master	basic-flow	f	t
a38aeb47-f27e-4e68-82ff-7cc7371a47a7	browser	browser based authentication	grafana	basic-flow	t	t
c53e357f-e276-43aa-b36c-46366a7ffd35	forms	Username, password, otp and other auth forms.	grafana	basic-flow	f	t
cf4831e9-3e1d-452e-984e-e6d4d9eeafb5	Browser - Conditional OTP	Flow to determine if the OTP is required for the authentication	grafana	basic-flow	f	t
b478ecfb-db7e-4797-a245-8fc3b4dec884	direct grant	OpenID Connect Resource Owner Grant	grafana	basic-flow	t	t
b3491338-0630-4232-97e7-a518c254b248	Direct Grant - Conditional OTP	Flow to determine if the OTP is required for the authentication	grafana	basic-flow	f	t
9d02badd-cb1c-4655-bf5e-f888861433ff	registration	registration flow	grafana	basic-flow	t	t
c3ed2ad1-cfb4-49fa-8c75-cf5047527c68	registration form	registration form	grafana	form-flow	f	t
3085fb68-fc1f-4e1c-a8be-33fb45194b04	reset credentials	Reset credentials for a user if they forgot their password or something	grafana	basic-flow	t	t
079166ff-6d61-4bb2-a26d-374b8558f628	Reset - Conditional OTP	Flow to determine if the OTP should be reset or not. Set to REQUIRED to force.	grafana	basic-flow	f	t
cbb4b3ca-ced6-4046-8b59-f1c3959c7948	clients	Base authentication for clients	grafana	client-flow	t	t
0af1201c-a206-4393-9528-cb6083b9caa0	first broker login	Actions taken after first broker login with identity provider account, which is not yet linked to any Keycloak account	grafana	basic-flow	t	t
df86516c-dcb1-41a8-877e-eb8805bcac8c	User creation or linking	Flow for the existing/non-existing user alternatives	grafana	basic-flow	f	t
9947a1b3-c26c-423f-b380-deadb5dce1ad	Handle Existing Account	Handle what to do if there is existing account with same email/username like authenticated identity provider	grafana	basic-flow	f	t
3c15ac69-f452-49ab-94d6-92e6bf809ebc	Account verification options	Method with which to verity the existing account	grafana	basic-flow	f	t
1075a862-7836-4d28-a191-8be19a6574cf	Verify Existing Account by Re-authentication	Reauthentication of existing account	grafana	basic-flow	f	t
21fbd70a-286f-431a-abc4-fbf6590fcdc3	First broker login - Conditional OTP	Flow to determine if the OTP is required for the authentication	grafana	basic-flow	f	t
ba53abf5-9a64-4371-810b-67378eb3d781	saml ecp	SAML ECP Profile Authentication Flow	grafana	basic-flow	t	t
95e02703-f5bc-4e04-8bef-f6adc2d8173f	docker auth	Used by Docker clients to authenticate against the IDP	grafana	basic-flow	t	t
f397495e-d073-4ef1-babf-569a338db596	http challenge	An authentication flow based on challenge-response HTTP Authentication Schemes	grafana	basic-flow	t	t
56c40f89-4d69-46fd-bb18-d6c01808d2af	Authentication Options	Authentication options.	grafana	basic-flow	f	t
\.


--
-- Data for Name: authenticator_config; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.authenticator_config (id, alias, realm_id) FROM stdin;
8ab33625-af83-4fcd-aa77-6bd365100d7b	review profile config	master
c7d1ba52-6053-4219-8118-a64cebfab1e1	create unique user config	master
e159a12b-cd0b-4241-a41c-e13f84e92052	review profile config	grafana
f159d9c3-3ea7-460d-a719-b9c88bcbf650	create unique user config	grafana
\.


--
-- Data for Name: authenticator_config_entry; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.authenticator_config_entry (authenticator_id, value, name) FROM stdin;
8ab33625-af83-4fcd-aa77-6bd365100d7b	missing	update.profile.on.first.login
c7d1ba52-6053-4219-8118-a64cebfab1e1	false	require.password.update.after.registration
e159a12b-cd0b-4241-a41c-e13f84e92052	missing	update.profile.on.first.login
f159d9c3-3ea7-460d-a719-b9c88bcbf650	false	require.password.update.after.registration
\.


--
-- Data for Name: broker_link; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.broker_link (identity_provider, storage_provider_id, realm_id, broker_user_id, broker_username, token, user_id) FROM stdin;
\.


--
-- Data for Name: client; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.client (id, enabled, full_scope_allowed, client_id, not_before, public_client, secret, base_url, bearer_only, management_url, surrogate_auth_required, realm_id, protocol, node_rereg_timeout, frontchannel_logout, consent_required, name, service_accounts_enabled, client_authenticator_type, root_url, description, registration_token, standard_flow_enabled, implicit_flow_enabled, direct_access_grants_enabled, always_display_in_console) FROM stdin;
3cd285ea-0f6e-43b6-ab5c-d021c33a551b	t	t	master-realm	0	f	e223073e-1025-4f3a-90d3-e79e3e4e8ffe	\N	t	\N	f	master	\N	0	f	f	master Realm	f	client-secret	\N	\N	\N	t	f	f	f
eed689c6-49da-4d91-98eb-cd495bcc07a3	t	f	account	0	f	edbe696c-b249-49c5-af33-b7e36f28a259	/realms/master/account/	f	\N	f	master	openid-connect	0	f	f	${client_account}	f	client-secret	${authBaseUrl}	\N	\N	t	f	f	f
11c67f5b-dde7-4680-b05b-c9c59d78bda4	t	f	account-console	0	t	3c802dbd-ab38-4f29-a7cd-799000d7fa6b	/realms/master/account/	f	\N	f	master	openid-connect	0	f	f	${client_account-console}	f	client-secret	${authBaseUrl}	\N	\N	t	f	f	f
1e30397c-eac2-41fb-87bc-d90484992e65	t	f	broker	0	f	44f53260-bed3-434f-b44f-bc4a8a546243	\N	f	\N	f	master	openid-connect	0	f	f	${client_broker}	f	client-secret	\N	\N	\N	t	f	f	f
2f521d09-7304-4b5e-a94b-7cc7300b8b50	t	f	security-admin-console	0	t	0abe5b86-38bd-458c-aee5-c88495207eef	/admin/master/console/	f	\N	f	master	openid-connect	0	f	f	${client_security-admin-console}	f	client-secret	${authAdminUrl}	\N	\N	t	f	f	f
63d16a7e-aa65-486e-a0e1-81f928d3e3b8	t	f	admin-cli	0	t	1cf461d4-8b50-45d9-b69a-7703c4d99f54	\N	f	\N	f	master	openid-connect	0	f	f	${client_admin-cli}	f	client-secret	\N	\N	\N	f	f	t	f
ef7f6eac-9fff-44aa-a86c-5125d52acc82	t	t	grafana-realm	0	f	969c7bb6-18d9-47d9-bd3a-b4440be4afe6	\N	t	\N	f	master	\N	0	f	f	grafana Realm	f	client-secret	\N	\N	\N	t	f	f	f
a8698f4f-5fa1-4baa-be05-87d03052af49	t	f	realm-management	0	f	a313dae0-428d-4b35-b5cd-724201173481	\N	t	\N	f	grafana	openid-connect	0	f	f	${client_realm-management}	f	client-secret	\N	\N	\N	t	f	f	f
a5a8fed6-0bca-4646-9946-2fe84175353b	t	f	account	0	f	d0b8b6b6-2a02-412c-84d1-716418c4f591	/realms/grafana/account/	f	\N	f	grafana	openid-connect	0	f	f	${client_account}	f	client-secret	${authBaseUrl}	\N	\N	t	f	f	f
230081b5-9161-45c3-9e08-9eda5412f7f7	t	f	account-console	0	t	5cf0655c-c137-438c-9c3c-bea9541f41f1	/realms/grafana/account/	f	\N	f	grafana	openid-connect	0	f	f	${client_account-console}	f	client-secret	${authBaseUrl}	\N	\N	t	f	f	f
77ff47f8-f578-477d-8c06-e70a846332f5	t	f	broker	0	f	589951e9-e77f-4d1d-90cd-796848190eff	\N	f	\N	f	grafana	openid-connect	0	f	f	${client_broker}	f	client-secret	\N	\N	\N	t	f	f	f
805aebc8-9d01-42b6-bcce-6ce48ca63ef0	t	f	security-admin-console	0	t	27d2217e-9934-4971-93b8-77969e47ecf7	/admin/grafana/console/	f	\N	f	grafana	openid-connect	0	f	f	${client_security-admin-console}	f	client-secret	${authAdminUrl}	\N	\N	t	f	f	f
6bd2d943-9800-4839-9ddc-03c04930cd9f	t	f	admin-cli	0	t	da0811c3-5031-4f35-9dc5-441050461a37	\N	f	\N	f	grafana	openid-connect	0	f	f	${client_admin-cli}	f	client-secret	\N	\N	\N	f	f	t	f
169f1dea-80f0-4a99-8509-9abb70ab0a5c	t	t	sample-iframe-project	0	t	c2ada58a-760e-40d7-8ddc-9ea69b465af2	\N	f	http://localhost:4200	f	grafana	openid-connect	-1	f	f	\N	f	client-secret	http://localhost:4200	\N	\N	t	f	t	f
09b79548-8426-4c0e-8e0b-7488467532c7	t	t	grafana-oauth	0	f	d17b9ea9-bcb1-43d2-b132-d339e55872a8	http://env.grafana.local:8087	f	http://env.grafana.local:8087	f	grafana	openid-connect	-1	f	f	\N	f	client-secret	http://env.grafana.local:8087	\N	\N	t	f	t	f
\.


--
-- Data for Name: client_attributes; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.client_attributes (client_id, value, name) FROM stdin;
11c67f5b-dde7-4680-b05b-c9c59d78bda4	S256	pkce.code.challenge.method
2f521d09-7304-4b5e-a94b-7cc7300b8b50	S256	pkce.code.challenge.method
230081b5-9161-45c3-9e08-9eda5412f7f7	S256	pkce.code.challenge.method
805aebc8-9d01-42b6-bcce-6ce48ca63ef0	S256	pkce.code.challenge.method
09b79548-8426-4c0e-8e0b-7488467532c7	true	backchannel.logout.session.required
09b79548-8426-4c0e-8e0b-7488467532c7	false	backchannel.logout.revoke.offline.tokens
09b79548-8426-4c0e-8e0b-7488467532c7	false	saml.server.signature
09b79548-8426-4c0e-8e0b-7488467532c7	false	saml.server.signature.keyinfo.ext
09b79548-8426-4c0e-8e0b-7488467532c7	false	saml.assertion.signature
09b79548-8426-4c0e-8e0b-7488467532c7	false	saml.client.signature
09b79548-8426-4c0e-8e0b-7488467532c7	false	saml.encrypt
09b79548-8426-4c0e-8e0b-7488467532c7	false	saml.authnstatement
09b79548-8426-4c0e-8e0b-7488467532c7	false	saml.onetimeuse.condition
09b79548-8426-4c0e-8e0b-7488467532c7	false	saml_force_name_id_format
09b79548-8426-4c0e-8e0b-7488467532c7	false	saml.multivalued.roles
09b79548-8426-4c0e-8e0b-7488467532c7	false	saml.force.post.binding
09b79548-8426-4c0e-8e0b-7488467532c7	false	exclude.session.state.from.auth.response
09b79548-8426-4c0e-8e0b-7488467532c7	false	tls.client.certificate.bound.access.tokens
09b79548-8426-4c0e-8e0b-7488467532c7	false	client_credentials.use_refresh_token
09b79548-8426-4c0e-8e0b-7488467532c7	false	display.on.consent.screen
09b79548-8426-4c0e-8e0b-7488467532c7		backchannel.logout.url
169f1dea-80f0-4a99-8509-9abb70ab0a5c	true	backchannel.logout.session.required
169f1dea-80f0-4a99-8509-9abb70ab0a5c	false	backchannel.logout.revoke.offline.tokens
169f1dea-80f0-4a99-8509-9abb70ab0a5c	false	saml.server.signature
169f1dea-80f0-4a99-8509-9abb70ab0a5c	false	saml.server.signature.keyinfo.ext
169f1dea-80f0-4a99-8509-9abb70ab0a5c	false	saml.assertion.signature
169f1dea-80f0-4a99-8509-9abb70ab0a5c	false	saml.client.signature
169f1dea-80f0-4a99-8509-9abb70ab0a5c	false	saml.encrypt
169f1dea-80f0-4a99-8509-9abb70ab0a5c	false	saml.authnstatement
169f1dea-80f0-4a99-8509-9abb70ab0a5c	false	saml.onetimeuse.condition
169f1dea-80f0-4a99-8509-9abb70ab0a5c	false	saml_force_name_id_format
169f1dea-80f0-4a99-8509-9abb70ab0a5c	false	saml.multivalued.roles
169f1dea-80f0-4a99-8509-9abb70ab0a5c	false	saml.force.post.binding
169f1dea-80f0-4a99-8509-9abb70ab0a5c	false	exclude.session.state.from.auth.response
169f1dea-80f0-4a99-8509-9abb70ab0a5c	false	tls.client.certificate.bound.access.tokens
169f1dea-80f0-4a99-8509-9abb70ab0a5c	false	client_credentials.use_refresh_token
169f1dea-80f0-4a99-8509-9abb70ab0a5c	false	display.on.consent.screen
\.


--
-- Data for Name: client_auth_flow_bindings; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.client_auth_flow_bindings (client_id, flow_id, binding_name) FROM stdin;
\.


--
-- Data for Name: client_default_roles; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.client_default_roles (client_id, role_id) FROM stdin;
eed689c6-49da-4d91-98eb-cd495bcc07a3	86a4b6a9-93db-4177-a72f-95fd937a2c8d
eed689c6-49da-4d91-98eb-cd495bcc07a3	619ba870-921e-4f28-b26c-89b11f39dddf
a5a8fed6-0bca-4646-9946-2fe84175353b	f1311ecb-6a6a-49d6-bb16-5132daf93a64
a5a8fed6-0bca-4646-9946-2fe84175353b	18a7066b-fe71-410e-9581-69f78347ec29
\.


--
-- Data for Name: client_initial_access; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.client_initial_access (id, realm_id, "timestamp", expiration, count, remaining_count) FROM stdin;
\.


--
-- Data for Name: client_node_registrations; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.client_node_registrations (client_id, value, name) FROM stdin;
\.


--
-- Data for Name: client_scope; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.client_scope (id, name, realm_id, description, protocol) FROM stdin;
0cc71c8c-fb37-41f2-b4d8-13210d3cf8be	offline_access	master	OpenID Connect built-in scope: offline_access	openid-connect
47f35d4b-35c7-4c6d-8bae-eff0a5046861	role_list	master	SAML role list	saml
66deef47-2158-4d5b-a75f-0bf42f642e7b	profile	master	OpenID Connect built-in scope: profile	openid-connect
94ef659c-4c4a-4a33-98e8-bfcf443e9268	email	master	OpenID Connect built-in scope: email	openid-connect
96a960d2-c203-4ef0-a53c-c3edd01f2305	address	master	OpenID Connect built-in scope: address	openid-connect
3f705379-3361-486d-b75a-f7b4e4be492c	phone	master	OpenID Connect built-in scope: phone	openid-connect
b8a9cdd1-2f30-4e23-a721-78b01cfba1d7	roles	master	OpenID Connect scope for add user roles to the access token	openid-connect
619cf41a-5ff8-4a04-9f1e-50717e5f7ce8	web-origins	master	OpenID Connect scope for add allowed web origins to the access token	openid-connect
42bfb506-bf0d-424e-8649-53a9a93d252d	microprofile-jwt	master	Microprofile - JWT built-in scope	openid-connect
0e98d5f9-d3f7-4b1d-9791-d442524fc2ab	offline_access	grafana	OpenID Connect built-in scope: offline_access	openid-connect
a1d5ab0b-6c06-4dc5-bdca-3fefe915f4f3	role_list	grafana	SAML role list	saml
74daf2cd-40d4-4304-87a8-92cdca808512	profile	grafana	OpenID Connect built-in scope: profile	openid-connect
96d521d3-facc-4b5a-a8b4-a879bae6be07	email	grafana	OpenID Connect built-in scope: email	openid-connect
a5bb3a5f-fd26-4be6-9557-26e20a03d33d	address	grafana	OpenID Connect built-in scope: address	openid-connect
d6ffe9fc-a03c-4496-85dc-dbb5e7754587	phone	grafana	OpenID Connect built-in scope: phone	openid-connect
d6077ed7-b265-4f82-9336-24614967bd5d	roles	grafana	OpenID Connect scope for add user roles to the access token	openid-connect
699671ab-e7c1-4fcf-beb8-ea54f1471fc1	web-origins	grafana	OpenID Connect scope for add allowed web origins to the access token	openid-connect
c61f5b19-c17e-49a1-91b8-a0296411b928	microprofile-jwt	grafana	Microprofile - JWT built-in scope	openid-connect
f619a55a-d565-4cc0-8bf4-4dbaab5382fe	username	grafana		openid-connect
0a7c7dde-23d7-4a93-bdee-4a8963aee9a4	login	grafana	login	openid-connect
d4723cd4-f717-44b7-a9b0-6c32c5ecd23f	name	grafana	user name	openid-connect
\.


--
-- Data for Name: client_scope_attributes; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.client_scope_attributes (scope_id, value, name) FROM stdin;
0cc71c8c-fb37-41f2-b4d8-13210d3cf8be	true	display.on.consent.screen
0cc71c8c-fb37-41f2-b4d8-13210d3cf8be	${offlineAccessScopeConsentText}	consent.screen.text
47f35d4b-35c7-4c6d-8bae-eff0a5046861	true	display.on.consent.screen
47f35d4b-35c7-4c6d-8bae-eff0a5046861	${samlRoleListScopeConsentText}	consent.screen.text
66deef47-2158-4d5b-a75f-0bf42f642e7b	true	display.on.consent.screen
66deef47-2158-4d5b-a75f-0bf42f642e7b	${profileScopeConsentText}	consent.screen.text
66deef47-2158-4d5b-a75f-0bf42f642e7b	true	include.in.token.scope
94ef659c-4c4a-4a33-98e8-bfcf443e9268	true	display.on.consent.screen
94ef659c-4c4a-4a33-98e8-bfcf443e9268	${emailScopeConsentText}	consent.screen.text
94ef659c-4c4a-4a33-98e8-bfcf443e9268	true	include.in.token.scope
96a960d2-c203-4ef0-a53c-c3edd01f2305	true	display.on.consent.screen
96a960d2-c203-4ef0-a53c-c3edd01f2305	${addressScopeConsentText}	consent.screen.text
96a960d2-c203-4ef0-a53c-c3edd01f2305	true	include.in.token.scope
3f705379-3361-486d-b75a-f7b4e4be492c	true	display.on.consent.screen
3f705379-3361-486d-b75a-f7b4e4be492c	${phoneScopeConsentText}	consent.screen.text
3f705379-3361-486d-b75a-f7b4e4be492c	true	include.in.token.scope
b8a9cdd1-2f30-4e23-a721-78b01cfba1d7	true	display.on.consent.screen
b8a9cdd1-2f30-4e23-a721-78b01cfba1d7	${rolesScopeConsentText}	consent.screen.text
b8a9cdd1-2f30-4e23-a721-78b01cfba1d7	false	include.in.token.scope
619cf41a-5ff8-4a04-9f1e-50717e5f7ce8	false	display.on.consent.screen
619cf41a-5ff8-4a04-9f1e-50717e5f7ce8		consent.screen.text
619cf41a-5ff8-4a04-9f1e-50717e5f7ce8	false	include.in.token.scope
42bfb506-bf0d-424e-8649-53a9a93d252d	false	display.on.consent.screen
42bfb506-bf0d-424e-8649-53a9a93d252d	true	include.in.token.scope
0e98d5f9-d3f7-4b1d-9791-d442524fc2ab	true	display.on.consent.screen
0e98d5f9-d3f7-4b1d-9791-d442524fc2ab	${offlineAccessScopeConsentText}	consent.screen.text
a1d5ab0b-6c06-4dc5-bdca-3fefe915f4f3	true	display.on.consent.screen
a1d5ab0b-6c06-4dc5-bdca-3fefe915f4f3	${samlRoleListScopeConsentText}	consent.screen.text
74daf2cd-40d4-4304-87a8-92cdca808512	true	display.on.consent.screen
74daf2cd-40d4-4304-87a8-92cdca808512	${profileScopeConsentText}	consent.screen.text
74daf2cd-40d4-4304-87a8-92cdca808512	true	include.in.token.scope
96d521d3-facc-4b5a-a8b4-a879bae6be07	true	display.on.consent.screen
96d521d3-facc-4b5a-a8b4-a879bae6be07	${emailScopeConsentText}	consent.screen.text
96d521d3-facc-4b5a-a8b4-a879bae6be07	true	include.in.token.scope
a5bb3a5f-fd26-4be6-9557-26e20a03d33d	true	display.on.consent.screen
a5bb3a5f-fd26-4be6-9557-26e20a03d33d	${addressScopeConsentText}	consent.screen.text
a5bb3a5f-fd26-4be6-9557-26e20a03d33d	true	include.in.token.scope
d6ffe9fc-a03c-4496-85dc-dbb5e7754587	true	display.on.consent.screen
d6ffe9fc-a03c-4496-85dc-dbb5e7754587	${phoneScopeConsentText}	consent.screen.text
d6ffe9fc-a03c-4496-85dc-dbb5e7754587	true	include.in.token.scope
d6077ed7-b265-4f82-9336-24614967bd5d	true	display.on.consent.screen
d6077ed7-b265-4f82-9336-24614967bd5d	${rolesScopeConsentText}	consent.screen.text
d6077ed7-b265-4f82-9336-24614967bd5d	false	include.in.token.scope
699671ab-e7c1-4fcf-beb8-ea54f1471fc1	false	display.on.consent.screen
699671ab-e7c1-4fcf-beb8-ea54f1471fc1		consent.screen.text
699671ab-e7c1-4fcf-beb8-ea54f1471fc1	false	include.in.token.scope
c61f5b19-c17e-49a1-91b8-a0296411b928	false	display.on.consent.screen
c61f5b19-c17e-49a1-91b8-a0296411b928	true	include.in.token.scope
f619a55a-d565-4cc0-8bf4-4dbaab5382fe	true	display.on.consent.screen
f619a55a-d565-4cc0-8bf4-4dbaab5382fe	true	include.in.token.scope
0a7c7dde-23d7-4a93-bdee-4a8963aee9a4	true	display.on.consent.screen
0a7c7dde-23d7-4a93-bdee-4a8963aee9a4	true	include.in.token.scope
d4723cd4-f717-44b7-a9b0-6c32c5ecd23f	true	display.on.consent.screen
d4723cd4-f717-44b7-a9b0-6c32c5ecd23f	true	include.in.token.scope
\.


--
-- Data for Name: client_scope_client; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.client_scope_client (client_id, scope_id, default_scope) FROM stdin;
eed689c6-49da-4d91-98eb-cd495bcc07a3	47f35d4b-35c7-4c6d-8bae-eff0a5046861	t
11c67f5b-dde7-4680-b05b-c9c59d78bda4	47f35d4b-35c7-4c6d-8bae-eff0a5046861	t
63d16a7e-aa65-486e-a0e1-81f928d3e3b8	47f35d4b-35c7-4c6d-8bae-eff0a5046861	t
1e30397c-eac2-41fb-87bc-d90484992e65	47f35d4b-35c7-4c6d-8bae-eff0a5046861	t
3cd285ea-0f6e-43b6-ab5c-d021c33a551b	47f35d4b-35c7-4c6d-8bae-eff0a5046861	t
2f521d09-7304-4b5e-a94b-7cc7300b8b50	47f35d4b-35c7-4c6d-8bae-eff0a5046861	t
eed689c6-49da-4d91-98eb-cd495bcc07a3	66deef47-2158-4d5b-a75f-0bf42f642e7b	t
eed689c6-49da-4d91-98eb-cd495bcc07a3	619cf41a-5ff8-4a04-9f1e-50717e5f7ce8	t
eed689c6-49da-4d91-98eb-cd495bcc07a3	94ef659c-4c4a-4a33-98e8-bfcf443e9268	t
eed689c6-49da-4d91-98eb-cd495bcc07a3	b8a9cdd1-2f30-4e23-a721-78b01cfba1d7	t
eed689c6-49da-4d91-98eb-cd495bcc07a3	3f705379-3361-486d-b75a-f7b4e4be492c	f
eed689c6-49da-4d91-98eb-cd495bcc07a3	0cc71c8c-fb37-41f2-b4d8-13210d3cf8be	f
eed689c6-49da-4d91-98eb-cd495bcc07a3	42bfb506-bf0d-424e-8649-53a9a93d252d	f
eed689c6-49da-4d91-98eb-cd495bcc07a3	96a960d2-c203-4ef0-a53c-c3edd01f2305	f
11c67f5b-dde7-4680-b05b-c9c59d78bda4	66deef47-2158-4d5b-a75f-0bf42f642e7b	t
11c67f5b-dde7-4680-b05b-c9c59d78bda4	619cf41a-5ff8-4a04-9f1e-50717e5f7ce8	t
11c67f5b-dde7-4680-b05b-c9c59d78bda4	94ef659c-4c4a-4a33-98e8-bfcf443e9268	t
11c67f5b-dde7-4680-b05b-c9c59d78bda4	b8a9cdd1-2f30-4e23-a721-78b01cfba1d7	t
11c67f5b-dde7-4680-b05b-c9c59d78bda4	3f705379-3361-486d-b75a-f7b4e4be492c	f
11c67f5b-dde7-4680-b05b-c9c59d78bda4	0cc71c8c-fb37-41f2-b4d8-13210d3cf8be	f
11c67f5b-dde7-4680-b05b-c9c59d78bda4	42bfb506-bf0d-424e-8649-53a9a93d252d	f
11c67f5b-dde7-4680-b05b-c9c59d78bda4	96a960d2-c203-4ef0-a53c-c3edd01f2305	f
63d16a7e-aa65-486e-a0e1-81f928d3e3b8	66deef47-2158-4d5b-a75f-0bf42f642e7b	t
63d16a7e-aa65-486e-a0e1-81f928d3e3b8	619cf41a-5ff8-4a04-9f1e-50717e5f7ce8	t
63d16a7e-aa65-486e-a0e1-81f928d3e3b8	94ef659c-4c4a-4a33-98e8-bfcf443e9268	t
63d16a7e-aa65-486e-a0e1-81f928d3e3b8	b8a9cdd1-2f30-4e23-a721-78b01cfba1d7	t
63d16a7e-aa65-486e-a0e1-81f928d3e3b8	3f705379-3361-486d-b75a-f7b4e4be492c	f
63d16a7e-aa65-486e-a0e1-81f928d3e3b8	0cc71c8c-fb37-41f2-b4d8-13210d3cf8be	f
63d16a7e-aa65-486e-a0e1-81f928d3e3b8	42bfb506-bf0d-424e-8649-53a9a93d252d	f
63d16a7e-aa65-486e-a0e1-81f928d3e3b8	96a960d2-c203-4ef0-a53c-c3edd01f2305	f
1e30397c-eac2-41fb-87bc-d90484992e65	66deef47-2158-4d5b-a75f-0bf42f642e7b	t
1e30397c-eac2-41fb-87bc-d90484992e65	619cf41a-5ff8-4a04-9f1e-50717e5f7ce8	t
1e30397c-eac2-41fb-87bc-d90484992e65	94ef659c-4c4a-4a33-98e8-bfcf443e9268	t
1e30397c-eac2-41fb-87bc-d90484992e65	b8a9cdd1-2f30-4e23-a721-78b01cfba1d7	t
1e30397c-eac2-41fb-87bc-d90484992e65	3f705379-3361-486d-b75a-f7b4e4be492c	f
1e30397c-eac2-41fb-87bc-d90484992e65	0cc71c8c-fb37-41f2-b4d8-13210d3cf8be	f
1e30397c-eac2-41fb-87bc-d90484992e65	42bfb506-bf0d-424e-8649-53a9a93d252d	f
1e30397c-eac2-41fb-87bc-d90484992e65	96a960d2-c203-4ef0-a53c-c3edd01f2305	f
3cd285ea-0f6e-43b6-ab5c-d021c33a551b	66deef47-2158-4d5b-a75f-0bf42f642e7b	t
3cd285ea-0f6e-43b6-ab5c-d021c33a551b	619cf41a-5ff8-4a04-9f1e-50717e5f7ce8	t
3cd285ea-0f6e-43b6-ab5c-d021c33a551b	94ef659c-4c4a-4a33-98e8-bfcf443e9268	t
3cd285ea-0f6e-43b6-ab5c-d021c33a551b	b8a9cdd1-2f30-4e23-a721-78b01cfba1d7	t
3cd285ea-0f6e-43b6-ab5c-d021c33a551b	3f705379-3361-486d-b75a-f7b4e4be492c	f
3cd285ea-0f6e-43b6-ab5c-d021c33a551b	0cc71c8c-fb37-41f2-b4d8-13210d3cf8be	f
3cd285ea-0f6e-43b6-ab5c-d021c33a551b	42bfb506-bf0d-424e-8649-53a9a93d252d	f
3cd285ea-0f6e-43b6-ab5c-d021c33a551b	96a960d2-c203-4ef0-a53c-c3edd01f2305	f
2f521d09-7304-4b5e-a94b-7cc7300b8b50	66deef47-2158-4d5b-a75f-0bf42f642e7b	t
2f521d09-7304-4b5e-a94b-7cc7300b8b50	619cf41a-5ff8-4a04-9f1e-50717e5f7ce8	t
2f521d09-7304-4b5e-a94b-7cc7300b8b50	94ef659c-4c4a-4a33-98e8-bfcf443e9268	t
2f521d09-7304-4b5e-a94b-7cc7300b8b50	b8a9cdd1-2f30-4e23-a721-78b01cfba1d7	t
2f521d09-7304-4b5e-a94b-7cc7300b8b50	3f705379-3361-486d-b75a-f7b4e4be492c	f
2f521d09-7304-4b5e-a94b-7cc7300b8b50	0cc71c8c-fb37-41f2-b4d8-13210d3cf8be	f
2f521d09-7304-4b5e-a94b-7cc7300b8b50	42bfb506-bf0d-424e-8649-53a9a93d252d	f
2f521d09-7304-4b5e-a94b-7cc7300b8b50	96a960d2-c203-4ef0-a53c-c3edd01f2305	f
ef7f6eac-9fff-44aa-a86c-5125d52acc82	47f35d4b-35c7-4c6d-8bae-eff0a5046861	t
ef7f6eac-9fff-44aa-a86c-5125d52acc82	66deef47-2158-4d5b-a75f-0bf42f642e7b	t
ef7f6eac-9fff-44aa-a86c-5125d52acc82	619cf41a-5ff8-4a04-9f1e-50717e5f7ce8	t
ef7f6eac-9fff-44aa-a86c-5125d52acc82	94ef659c-4c4a-4a33-98e8-bfcf443e9268	t
ef7f6eac-9fff-44aa-a86c-5125d52acc82	b8a9cdd1-2f30-4e23-a721-78b01cfba1d7	t
ef7f6eac-9fff-44aa-a86c-5125d52acc82	3f705379-3361-486d-b75a-f7b4e4be492c	f
ef7f6eac-9fff-44aa-a86c-5125d52acc82	0cc71c8c-fb37-41f2-b4d8-13210d3cf8be	f
ef7f6eac-9fff-44aa-a86c-5125d52acc82	42bfb506-bf0d-424e-8649-53a9a93d252d	f
ef7f6eac-9fff-44aa-a86c-5125d52acc82	96a960d2-c203-4ef0-a53c-c3edd01f2305	f
a5a8fed6-0bca-4646-9946-2fe84175353b	a1d5ab0b-6c06-4dc5-bdca-3fefe915f4f3	t
230081b5-9161-45c3-9e08-9eda5412f7f7	a1d5ab0b-6c06-4dc5-bdca-3fefe915f4f3	t
6bd2d943-9800-4839-9ddc-03c04930cd9f	a1d5ab0b-6c06-4dc5-bdca-3fefe915f4f3	t
77ff47f8-f578-477d-8c06-e70a846332f5	a1d5ab0b-6c06-4dc5-bdca-3fefe915f4f3	t
a8698f4f-5fa1-4baa-be05-87d03052af49	a1d5ab0b-6c06-4dc5-bdca-3fefe915f4f3	t
805aebc8-9d01-42b6-bcce-6ce48ca63ef0	a1d5ab0b-6c06-4dc5-bdca-3fefe915f4f3	t
a5a8fed6-0bca-4646-9946-2fe84175353b	d6077ed7-b265-4f82-9336-24614967bd5d	t
a5a8fed6-0bca-4646-9946-2fe84175353b	74daf2cd-40d4-4304-87a8-92cdca808512	t
a5a8fed6-0bca-4646-9946-2fe84175353b	96d521d3-facc-4b5a-a8b4-a879bae6be07	t
a5a8fed6-0bca-4646-9946-2fe84175353b	699671ab-e7c1-4fcf-beb8-ea54f1471fc1	t
a5a8fed6-0bca-4646-9946-2fe84175353b	0e98d5f9-d3f7-4b1d-9791-d442524fc2ab	f
a5a8fed6-0bca-4646-9946-2fe84175353b	a5bb3a5f-fd26-4be6-9557-26e20a03d33d	f
a5a8fed6-0bca-4646-9946-2fe84175353b	d6ffe9fc-a03c-4496-85dc-dbb5e7754587	f
a5a8fed6-0bca-4646-9946-2fe84175353b	c61f5b19-c17e-49a1-91b8-a0296411b928	f
230081b5-9161-45c3-9e08-9eda5412f7f7	d6077ed7-b265-4f82-9336-24614967bd5d	t
230081b5-9161-45c3-9e08-9eda5412f7f7	74daf2cd-40d4-4304-87a8-92cdca808512	t
230081b5-9161-45c3-9e08-9eda5412f7f7	96d521d3-facc-4b5a-a8b4-a879bae6be07	t
230081b5-9161-45c3-9e08-9eda5412f7f7	699671ab-e7c1-4fcf-beb8-ea54f1471fc1	t
230081b5-9161-45c3-9e08-9eda5412f7f7	0e98d5f9-d3f7-4b1d-9791-d442524fc2ab	f
230081b5-9161-45c3-9e08-9eda5412f7f7	a5bb3a5f-fd26-4be6-9557-26e20a03d33d	f
230081b5-9161-45c3-9e08-9eda5412f7f7	d6ffe9fc-a03c-4496-85dc-dbb5e7754587	f
230081b5-9161-45c3-9e08-9eda5412f7f7	c61f5b19-c17e-49a1-91b8-a0296411b928	f
6bd2d943-9800-4839-9ddc-03c04930cd9f	d6077ed7-b265-4f82-9336-24614967bd5d	t
6bd2d943-9800-4839-9ddc-03c04930cd9f	74daf2cd-40d4-4304-87a8-92cdca808512	t
6bd2d943-9800-4839-9ddc-03c04930cd9f	96d521d3-facc-4b5a-a8b4-a879bae6be07	t
6bd2d943-9800-4839-9ddc-03c04930cd9f	699671ab-e7c1-4fcf-beb8-ea54f1471fc1	t
6bd2d943-9800-4839-9ddc-03c04930cd9f	0e98d5f9-d3f7-4b1d-9791-d442524fc2ab	f
6bd2d943-9800-4839-9ddc-03c04930cd9f	a5bb3a5f-fd26-4be6-9557-26e20a03d33d	f
6bd2d943-9800-4839-9ddc-03c04930cd9f	d6ffe9fc-a03c-4496-85dc-dbb5e7754587	f
6bd2d943-9800-4839-9ddc-03c04930cd9f	c61f5b19-c17e-49a1-91b8-a0296411b928	f
77ff47f8-f578-477d-8c06-e70a846332f5	d6077ed7-b265-4f82-9336-24614967bd5d	t
77ff47f8-f578-477d-8c06-e70a846332f5	74daf2cd-40d4-4304-87a8-92cdca808512	t
77ff47f8-f578-477d-8c06-e70a846332f5	96d521d3-facc-4b5a-a8b4-a879bae6be07	t
77ff47f8-f578-477d-8c06-e70a846332f5	699671ab-e7c1-4fcf-beb8-ea54f1471fc1	t
77ff47f8-f578-477d-8c06-e70a846332f5	0e98d5f9-d3f7-4b1d-9791-d442524fc2ab	f
77ff47f8-f578-477d-8c06-e70a846332f5	a5bb3a5f-fd26-4be6-9557-26e20a03d33d	f
77ff47f8-f578-477d-8c06-e70a846332f5	d6ffe9fc-a03c-4496-85dc-dbb5e7754587	f
77ff47f8-f578-477d-8c06-e70a846332f5	c61f5b19-c17e-49a1-91b8-a0296411b928	f
a8698f4f-5fa1-4baa-be05-87d03052af49	d6077ed7-b265-4f82-9336-24614967bd5d	t
a8698f4f-5fa1-4baa-be05-87d03052af49	74daf2cd-40d4-4304-87a8-92cdca808512	t
a8698f4f-5fa1-4baa-be05-87d03052af49	96d521d3-facc-4b5a-a8b4-a879bae6be07	t
a8698f4f-5fa1-4baa-be05-87d03052af49	699671ab-e7c1-4fcf-beb8-ea54f1471fc1	t
a8698f4f-5fa1-4baa-be05-87d03052af49	0e98d5f9-d3f7-4b1d-9791-d442524fc2ab	f
a8698f4f-5fa1-4baa-be05-87d03052af49	a5bb3a5f-fd26-4be6-9557-26e20a03d33d	f
a8698f4f-5fa1-4baa-be05-87d03052af49	d6ffe9fc-a03c-4496-85dc-dbb5e7754587	f
a8698f4f-5fa1-4baa-be05-87d03052af49	c61f5b19-c17e-49a1-91b8-a0296411b928	f
805aebc8-9d01-42b6-bcce-6ce48ca63ef0	d6077ed7-b265-4f82-9336-24614967bd5d	t
805aebc8-9d01-42b6-bcce-6ce48ca63ef0	74daf2cd-40d4-4304-87a8-92cdca808512	t
805aebc8-9d01-42b6-bcce-6ce48ca63ef0	96d521d3-facc-4b5a-a8b4-a879bae6be07	t
805aebc8-9d01-42b6-bcce-6ce48ca63ef0	699671ab-e7c1-4fcf-beb8-ea54f1471fc1	t
805aebc8-9d01-42b6-bcce-6ce48ca63ef0	0e98d5f9-d3f7-4b1d-9791-d442524fc2ab	f
805aebc8-9d01-42b6-bcce-6ce48ca63ef0	a5bb3a5f-fd26-4be6-9557-26e20a03d33d	f
805aebc8-9d01-42b6-bcce-6ce48ca63ef0	d6ffe9fc-a03c-4496-85dc-dbb5e7754587	f
805aebc8-9d01-42b6-bcce-6ce48ca63ef0	c61f5b19-c17e-49a1-91b8-a0296411b928	f
09b79548-8426-4c0e-8e0b-7488467532c7	a1d5ab0b-6c06-4dc5-bdca-3fefe915f4f3	t
09b79548-8426-4c0e-8e0b-7488467532c7	96d521d3-facc-4b5a-a8b4-a879bae6be07	t
09b79548-8426-4c0e-8e0b-7488467532c7	d6077ed7-b265-4f82-9336-24614967bd5d	t
09b79548-8426-4c0e-8e0b-7488467532c7	d4723cd4-f717-44b7-a9b0-6c32c5ecd23f	t
09b79548-8426-4c0e-8e0b-7488467532c7	0a7c7dde-23d7-4a93-bdee-4a8963aee9a4	t
09b79548-8426-4c0e-8e0b-7488467532c7	74daf2cd-40d4-4304-87a8-92cdca808512	t
169f1dea-80f0-4a99-8509-9abb70ab0a5c	d6077ed7-b265-4f82-9336-24614967bd5d	t
169f1dea-80f0-4a99-8509-9abb70ab0a5c	74daf2cd-40d4-4304-87a8-92cdca808512	t
169f1dea-80f0-4a99-8509-9abb70ab0a5c	96d521d3-facc-4b5a-a8b4-a879bae6be07	t
169f1dea-80f0-4a99-8509-9abb70ab0a5c	699671ab-e7c1-4fcf-beb8-ea54f1471fc1	t
169f1dea-80f0-4a99-8509-9abb70ab0a5c	0e98d5f9-d3f7-4b1d-9791-d442524fc2ab	f
169f1dea-80f0-4a99-8509-9abb70ab0a5c	a5bb3a5f-fd26-4be6-9557-26e20a03d33d	f
169f1dea-80f0-4a99-8509-9abb70ab0a5c	d6ffe9fc-a03c-4496-85dc-dbb5e7754587	f
169f1dea-80f0-4a99-8509-9abb70ab0a5c	c61f5b19-c17e-49a1-91b8-a0296411b928	f
\.


--
-- Data for Name: client_scope_role_mapping; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.client_scope_role_mapping (scope_id, role_id) FROM stdin;
0cc71c8c-fb37-41f2-b4d8-13210d3cf8be	16d5987b-dcbb-4650-8f52-3469f3974846
0e98d5f9-d3f7-4b1d-9791-d442524fc2ab	c49bddc6-ec92-4caa-bc04-57ba80a92eb9
\.


--
-- Data for Name: client_session; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.client_session (id, client_id, redirect_uri, state, "timestamp", session_id, auth_method, realm_id, auth_user_id, current_action) FROM stdin;
\.


--
-- Data for Name: client_session_auth_status; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.client_session_auth_status (authenticator, status, client_session) FROM stdin;
\.


--
-- Data for Name: client_session_note; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.client_session_note (name, value, client_session) FROM stdin;
\.


--
-- Data for Name: client_session_prot_mapper; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.client_session_prot_mapper (protocol_mapper_id, client_session) FROM stdin;
\.


--
-- Data for Name: client_session_role; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.client_session_role (role_id, client_session) FROM stdin;
\.


--
-- Data for Name: client_user_session_note; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.client_user_session_note (name, value, client_session) FROM stdin;
\.


--
-- Data for Name: component; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.component (id, name, parent_id, provider_id, provider_type, realm_id, sub_type) FROM stdin;
bf743b0a-d8f9-4635-bcbe-e1c8b92075e2	Trusted Hosts	master	trusted-hosts	org.keycloak.services.clientregistration.policy.ClientRegistrationPolicy	master	anonymous
d6e91e34-9d10-46e6-a343-c767cd9817ab	Consent Required	master	consent-required	org.keycloak.services.clientregistration.policy.ClientRegistrationPolicy	master	anonymous
b914dfd7-6556-40b2-8055-bf0a131d9b6a	Full Scope Disabled	master	scope	org.keycloak.services.clientregistration.policy.ClientRegistrationPolicy	master	anonymous
2ab822d8-3278-42f3-a27a-e9d7104ce361	Max Clients Limit	master	max-clients	org.keycloak.services.clientregistration.policy.ClientRegistrationPolicy	master	anonymous
f95566ed-b955-4668-88fc-e7413fd98615	Allowed Protocol Mapper Types	master	allowed-protocol-mappers	org.keycloak.services.clientregistration.policy.ClientRegistrationPolicy	master	anonymous
588cf9d4-1fb1-43d5-b454-9f9239d1dda7	Allowed Client Scopes	master	allowed-client-templates	org.keycloak.services.clientregistration.policy.ClientRegistrationPolicy	master	anonymous
28d2466c-5af6-4786-a8a2-c25d6cb4833f	Allowed Protocol Mapper Types	master	allowed-protocol-mappers	org.keycloak.services.clientregistration.policy.ClientRegistrationPolicy	master	authenticated
1dc5700c-668d-4988-8920-f1b21f22aaa2	Allowed Client Scopes	master	allowed-client-templates	org.keycloak.services.clientregistration.policy.ClientRegistrationPolicy	master	authenticated
ec24e563-c82e-4a0f-89db-6c2b75e5383a	fallback-HS256	master	hmac-generated	org.keycloak.keys.KeyProvider	master	\N
281b3291-097c-42af-8d52-46606d3b669f	fallback-RS256	master	rsa-generated	org.keycloak.keys.KeyProvider	master	\N
80af2f23-4a51-498a-a011-732cf9cfa8f8	rsa-generated	grafana	rsa-generated	org.keycloak.keys.KeyProvider	grafana	\N
a5b75d44-0bf1-400e-9e87-4293efeb3051	hmac-generated	grafana	hmac-generated	org.keycloak.keys.KeyProvider	grafana	\N
9877acf2-e1cc-4038-a3c2-75db29b432e0	aes-generated	grafana	aes-generated	org.keycloak.keys.KeyProvider	grafana	\N
5a1232c0-4243-454f-a26e-5d771efd3585	Trusted Hosts	grafana	trusted-hosts	org.keycloak.services.clientregistration.policy.ClientRegistrationPolicy	grafana	anonymous
5382514f-29bc-4cfd-b1b9-e1cf85dc1ed3	Consent Required	grafana	consent-required	org.keycloak.services.clientregistration.policy.ClientRegistrationPolicy	grafana	anonymous
1e55b1d2-5402-4b33-8c4a-59d0d5ddba32	Full Scope Disabled	grafana	scope	org.keycloak.services.clientregistration.policy.ClientRegistrationPolicy	grafana	anonymous
3021f045-3220-4e56-872c-d3491f6601f6	Max Clients Limit	grafana	max-clients	org.keycloak.services.clientregistration.policy.ClientRegistrationPolicy	grafana	anonymous
cb7cf482-8ac6-4999-ab67-1d48fef549f5	Allowed Protocol Mapper Types	grafana	allowed-protocol-mappers	org.keycloak.services.clientregistration.policy.ClientRegistrationPolicy	grafana	anonymous
7488860e-5bba-4f89-bde2-c63b0290cc0f	Allowed Client Scopes	grafana	allowed-client-templates	org.keycloak.services.clientregistration.policy.ClientRegistrationPolicy	grafana	anonymous
261e38de-3e1f-40a3-9200-f5aac1975701	Allowed Protocol Mapper Types	grafana	allowed-protocol-mappers	org.keycloak.services.clientregistration.policy.ClientRegistrationPolicy	grafana	authenticated
4223e0de-8a82-464f-b466-048d3682d8df	Allowed Client Scopes	grafana	allowed-client-templates	org.keycloak.services.clientregistration.policy.ClientRegistrationPolicy	grafana	authenticated
\.


--
-- Data for Name: component_config; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.component_config (id, component_id, name, value) FROM stdin;
9a09b41f-3340-49d7-b65c-fb02300ac5a0	1dc5700c-668d-4988-8920-f1b21f22aaa2	allow-default-scopes	true
81cf1edb-60cb-4336-8e61-3676e82a8496	f95566ed-b955-4668-88fc-e7413fd98615	allowed-protocol-mapper-types	saml-role-list-mapper
ebd9fd67-3468-4640-a130-dadf8bd0d3dd	f95566ed-b955-4668-88fc-e7413fd98615	allowed-protocol-mapper-types	oidc-address-mapper
5a2075e1-ff50-4221-ba0f-13c221b745f1	f95566ed-b955-4668-88fc-e7413fd98615	allowed-protocol-mapper-types	oidc-sha256-pairwise-sub-mapper
d47557df-07ff-4cae-bedd-b584c0697852	f95566ed-b955-4668-88fc-e7413fd98615	allowed-protocol-mapper-types	saml-user-attribute-mapper
91a7d433-6520-4710-a95a-b1d6ed1932f7	f95566ed-b955-4668-88fc-e7413fd98615	allowed-protocol-mapper-types	oidc-usermodel-attribute-mapper
35c3fff3-1779-4ea1-b8c2-b93b746ad4df	f95566ed-b955-4668-88fc-e7413fd98615	allowed-protocol-mapper-types	oidc-usermodel-property-mapper
64312a90-809f-455e-b89e-52b9f0a34229	f95566ed-b955-4668-88fc-e7413fd98615	allowed-protocol-mapper-types	oidc-full-name-mapper
5f0a8c49-4279-41bc-9b1f-cdf3acf14bc9	f95566ed-b955-4668-88fc-e7413fd98615	allowed-protocol-mapper-types	saml-user-property-mapper
2ae4acc4-c6d6-4d2f-92c6-3a222a7d078a	28d2466c-5af6-4786-a8a2-c25d6cb4833f	allowed-protocol-mapper-types	oidc-sha256-pairwise-sub-mapper
880a35e4-65a1-4697-836d-fbc46641d676	28d2466c-5af6-4786-a8a2-c25d6cb4833f	allowed-protocol-mapper-types	oidc-full-name-mapper
b087e631-754f-4c03-8cfc-354c7e7456fe	28d2466c-5af6-4786-a8a2-c25d6cb4833f	allowed-protocol-mapper-types	oidc-usermodel-property-mapper
079e63d4-0862-4e63-a62f-1a168cbbc25c	28d2466c-5af6-4786-a8a2-c25d6cb4833f	allowed-protocol-mapper-types	saml-user-property-mapper
da61fbc2-7533-4bc1-b0c4-357db9f108e4	28d2466c-5af6-4786-a8a2-c25d6cb4833f	allowed-protocol-mapper-types	oidc-address-mapper
37a4be58-26b0-4d4a-9c41-a89b27fc25f6	28d2466c-5af6-4786-a8a2-c25d6cb4833f	allowed-protocol-mapper-types	saml-user-attribute-mapper
0eb7fcb8-1afb-4d73-bbf7-9827e7669990	28d2466c-5af6-4786-a8a2-c25d6cb4833f	allowed-protocol-mapper-types	oidc-usermodel-attribute-mapper
1e0e9459-5116-46b7-a247-0212c2e8d719	28d2466c-5af6-4786-a8a2-c25d6cb4833f	allowed-protocol-mapper-types	saml-role-list-mapper
6bd5567c-e438-4884-a7ad-4f0450f2c75b	2ab822d8-3278-42f3-a27a-e9d7104ce361	max-clients	200
13ec6e6a-b4a9-4ca6-bee5-fe6d7df07bd4	588cf9d4-1fb1-43d5-b454-9f9239d1dda7	allow-default-scopes	true
9e4f8b41-d2e6-4b67-9784-f319b804b66b	bf743b0a-d8f9-4635-bcbe-e1c8b92075e2	host-sending-registration-request-must-match	true
4ca659f4-e9cf-45ff-a891-42b973fee220	bf743b0a-d8f9-4635-bcbe-e1c8b92075e2	client-uris-must-match	true
69a74c94-26ec-40d1-8859-c3077a84c374	ec24e563-c82e-4a0f-89db-6c2b75e5383a	secret	R0msuv6OjhKyzluLnbkkgkM1s0Mi5aK0Ck-3o-kbGMwsE2TPdzsoH-9Z_P2OEmJ6dqppkp9H8eZE9pdC8uDJHA
19b2af74-0667-4ade-993e-d734eb465a16	ec24e563-c82e-4a0f-89db-6c2b75e5383a	algorithm	HS256
b2a0d967-1111-4c79-9273-e05450fe26c5	ec24e563-c82e-4a0f-89db-6c2b75e5383a	priority	-100
63fba7e3-ad5f-475b-a367-8c0af5302b0b	ec24e563-c82e-4a0f-89db-6c2b75e5383a	kid	e19299b5-a2bc-45d4-bd71-2beeaab7dfbf
c2e6f8d9-fa94-4cda-8cab-558695b50ae4	281b3291-097c-42af-8d52-46606d3b669f	privateKey	MIIEowIBAAKCAQEAjuRpHyJ/1ki93NW9sMrppl7MC4DfzODtvirvslRfYvhVMm0rMWPw2q1bqrrzQMR+VdKQbp+M7jt9PYryNrzsGy+iiD7mi+KTrLnmQ+c+r867flwbivBB0LR63LidcpOExVUuREwilOcywfFXeFiBQ9Tbxcwztu6J+b9kjlSYNSg+JCzn2Wn2kMQXSTd2ddxBHs8bmxyibg18UMovJLt42E8/C8+3iP7++5gSy9FeVCjf1eIh7EF3LwPNJxeyJhd3fNfmB8YnWGoz2Jw1RZE7Hm/BW5uSsM7rQpkvEACHbsMCSlzxvJjzSGHYG+PksMgfiDLiezxBQhgD+5Z5DhImywIDAQABAoIBAFAAKaq40gHS8Bm3wWA9+tqesHawTJyUQgb6WwDopA7xIiH9ZPVeEvcbn/rSeGaGnITIQvzsbybiP5g5NqrW0wnVfZXyQXmH/U3zNqxFx57+i5KPVwxOv0puAWuaIOyJEwi4TBMI3UOovY4/5M0IIDct8W2oijudCbq+ITpeumjnrJxwV0aSlD6hYKiL4OWtcFJiAu+ZeSOlQOTY2jielAvlnOmFygx2KWE7I/JUhu2w2hO2Q1aQHPgbbPR8VxRZLID411VztuW3T4w9ur057YRIqB16ZwI6knMETGxHc1rYo6mMh+t45rWHzJ+hKJC/NKQ+IRI1U4YfUXDkdAg2b+ECgYEAyHdHS9p9lcQQFqkZVL2FLeEAbhkosAZjIe7gblj2Kt57QKJ6NJangV61hqHAr93uU3DJu5bertsCZjqN7SHelusyUXEBc4SrFhftjZNFsnRB/yj3jU3ag11Ro40cBW7fosUgrieUI3CZEB0SPdXoc7LgwheEViKu9zyPl+PcyD8CgYEAtnoZBJMaEl6mjkXjLhKM5U5eT50pDPct9p/pl5fwpBxPkJJXBYMuybjff1D+VlAboMOImLOijjjgS7bcr/DvnOCIhqy9FMT+57KxAaa1ZcrQ4MUj3Tj4Vg0kDMbu5GMZ40lmOjR6tTrIy0riOk64rJAPztcLoV2gFl98Dwp83nUCgYA6UpGYnQGqn/c6UIpBID5uAac5YPJ4e/M9fR0onZNJF59uR5ccU7R6LA7OE6NWx0++UPMwM42n+6nwChseoZr794OVNDaC4FdSPzXq2a0OZUqKLOYQ41SuoWjOF5DOd9pypb2DTZqI0QqHKJ4VBXXyq1k+vs7OrJqQ7bqtKyshywKBgQCw/1PfBRTH9rlVzWJkISg7kD2YudfEtMoHq+s32PBZLwDaOahhN3Kdxk47v4NEk6WI1cFcZPnrPC4MIw6DNpAlOgITp+AsEj0y3zgkYuEXIJhlPbPg9E6loU9zeU7lh17oAR1AngDcY227CyLO7ebhs0cyGZM1bYxHx0ydhk3CtQKBgHIT08PBgZYhHPJZ09H76gKTKcoL2XS4uEJb6/xjp4ACa1wlFhWZmUOq/DhWeAx313Mf5sRAGQGieiaPamBwt9cOai6V+Agk1YMS97Fg4eV/aYThor8qi1O3dEGSFw4GaGGwvL7Trvcpogk2N6+Pm2LJ5aPy048FPnR+YZ9/yIzr
c35d99d1-ca8d-4f82-bbb8-0a7b663e9d09	281b3291-097c-42af-8d52-46606d3b669f	algorithm	RS256
3f4c9dd6-37cc-444d-b9d0-caba781e20cd	281b3291-097c-42af-8d52-46606d3b669f	priority	-100
4bc9ffd3-9f15-442f-bdbf-aa5a73adfa65	281b3291-097c-42af-8d52-46606d3b669f	certificate	MIICmzCCAYMCBgF+u1WYqDANBgkqhkiG9w0BAQsFADARMQ8wDQYDVQQDDAZtYXN0ZXIwHhcNMjIwMjAyMTY0NTU2WhcNMzIwMjAyMTY0NzM2WjARMQ8wDQYDVQQDDAZtYXN0ZXIwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCO5GkfIn/WSL3c1b2wyummXswLgN/M4O2+Ku+yVF9i+FUybSsxY/DarVuquvNAxH5V0pBun4zuO309ivI2vOwbL6KIPuaL4pOsueZD5z6vzrt+XBuK8EHQtHrcuJ1yk4TFVS5ETCKU5zLB8Vd4WIFD1NvFzDO27on5v2SOVJg1KD4kLOfZafaQxBdJN3Z13EEezxubHKJuDXxQyi8ku3jYTz8Lz7eI/v77mBLL0V5UKN/V4iHsQXcvA80nF7ImF3d81+YHxidYajPYnDVFkTseb8Fbm5KwzutCmS8QAIduwwJKXPG8mPNIYdgb4+SwyB+IMuJ7PEFCGAP7lnkOEibLAgMBAAEwDQYJKoZIhvcNAQELBQADggEBAIXG0C7YyWpCrpIUfq3dKFSISjUJ3yfJsm7UX43YeFhSk0XKaeNaP0IfDa1zu4x2BbmsKZn8QI6DHENRPxcVFutkjuVbdLUWz8JxnpKzvKHiJX+CnL1PZ1RKM6coQi/hX1uI3dNM/kQk/FzkhspD2l3Q/7F2ix5sFk6G0UrlvJ7NgR2hy4DujhvsO+tF5hq2ZvLn4WCbiMgLPzDIcvDSm1ytWPSpSKGJs+zANotZnVRTkYF5bXKQH8EEdbgcU9sIHy/UJ08bSQ/9H/j2X8W+62eOchQjzNK5DslwoN2jakK0JJeNvRfIM8ETucLC4e+jCAB2QaeKnjpX7CrA8hiN8AM=
a3fdfa84-e986-426d-ba8e-49f2bdb91cd8	a5b75d44-0bf1-400e-9e87-4293efeb3051	priority	100
0240dece-6d4d-41e0-a64f-5e863a44354a	a5b75d44-0bf1-400e-9e87-4293efeb3051	algorithm	HS256
93341052-b55f-43fd-8f15-72b5812024d3	a5b75d44-0bf1-400e-9e87-4293efeb3051	secret	YrYYWSiul7DxTUeKd5ZeFlyrDLvJj0aOY5UMijdFx6qaDkwjMSl74kMAso4cID-qX582X_n-_vcbWFkwpdJDyA
ea21db3f-c474-445c-926d-e7d161e5721f	a5b75d44-0bf1-400e-9e87-4293efeb3051	kid	bb678665-e694-435a-b5bb-8c11e4727c1c
bb8c28ca-bb74-4a07-82c3-8293354517be	9877acf2-e1cc-4038-a3c2-75db29b432e0	secret	mjCx83NwCZkLHZ5sRvZ7lw
08300dda-1f12-45b7-98b5-23805cb1ed84	9877acf2-e1cc-4038-a3c2-75db29b432e0	priority	100
64ea89c8-a2ce-4d2d-896d-aa49e7ca9fcc	9877acf2-e1cc-4038-a3c2-75db29b432e0	kid	7d80efc5-222b-4b6d-9b99-c3b516a59733
bec1483f-75e7-46e8-916c-102db4cbefb5	80af2f23-4a51-498a-a011-732cf9cfa8f8	certificate	MIICnTCCAYUCBgF+u1ir8jANBgkqhkiG9w0BAQsFADASMRAwDgYDVQQDDAdncmFmYW5hMB4XDTIyMDIwMjE2NDkxN1oXDTMyMDIwMjE2NTA1N1owEjEQMA4GA1UEAwwHZ3JhZmFuYTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAKg5kB303DkDs5jSW1b7b7kvKfxIJorHD+7wPz2TcisfTu7rchrqAJiR/HtsPICyAw1h5ef8fGgCJf/k0z00osl/COvK8iHUdvGUnubuKUXaVwlbyaTnnyjSMUAkx+67OCrkY9B2drtZrtVc+fwnggqCsCkpoXg97tcUyfPlcUJnanxsYbirZ5KH+/e+x1jlsuBiwxascmB4IoT/zJknk5l1IVXmSOiDgqhzKRfHhVlRijOlfKyCn/EDtiv7wyQTP9wvd97zGPJqkkF2yNxueMftJsgGkF6+CZMY71BioOWAt2V8OwI32b/1v30DhtBmKdoUNGpEeCjSk91zzZqTFZUCAwEAATANBgkqhkiG9w0BAQsFAAOCAQEABlW64QxuREB81VMGsyhj4Q5RykFaVuD5O8YlwUpmVfAVLzb0Drf54Kn4bnpnckKyYV+T+HsN4QXt81UE41xH0Aai2H3vrGH+PJf6aLPCDE+jpMqtN3n6IgImJXJPL8upMfhhWDv4nkM4uynEwWupzmrKi4oJuTETSMktJby4o6//XWnCzCVMoAGFJU4gtjBUzOMLW26zD+yc+BuUtfR3HzItVHSZKQSNSFO0kVS68RgrER8qJw07z3BOJ2bPpPM0PYyEngGMaowz/T6lI32ymGMWYMAnslthS1KAW9xcTBwnrW1nMhe5a0LPxIktys/wJtxIHZLc5sOddGT4xYklLg==
48e8b904-1393-43a4-aaa1-30e2d9634b36	80af2f23-4a51-498a-a011-732cf9cfa8f8	privateKey	MIIEowIBAAKCAQEAqDmQHfTcOQOzmNJbVvtvuS8p/EgmiscP7vA/PZNyKx9O7utyGuoAmJH8e2w8gLIDDWHl5/x8aAIl/+TTPTSiyX8I68ryIdR28ZSe5u4pRdpXCVvJpOefKNIxQCTH7rs4KuRj0HZ2u1mu1Vz5/CeCCoKwKSmheD3u1xTJ8+VxQmdqfGxhuKtnkof7977HWOWy4GLDFqxyYHgihP/MmSeTmXUhVeZI6IOCqHMpF8eFWVGKM6V8rIKf8QO2K/vDJBM/3C933vMY8mqSQXbI3G54x+0myAaQXr4JkxjvUGKg5YC3ZXw7AjfZv/W/fQOG0GYp2hQ0akR4KNKT3XPNmpMVlQIDAQABAoIBAF3kEt3FZoyj1j97WOOJXmf7PPHDy081n1z61jEl9FjBFqse2gbPiBmfkU3JsVMbB70WYN1D/KOIX3EdZBELKbhQoMgJ826SSPi4vJ+jWYHVRTLB+h+B70E3X6mvXa+O6uB1rIgTNl2Gxp/rTtM/scLwAiZXR/n2hzGgNr9b1gT7D7kyCUIKDiJsQed2pA6ZbSDNTQQDE2qeN/Rr/+VV4XRuIIdBXn+Brap8ihjx4Gnn/SDBKM3MZoacwgS+9CZNhLjs8Ou4xD+KyitbbGGY4ZK/ZW2eSAH4ra8vVGTDK6bJrMTAE/73A23Evp/sKtRkFqcNumJ3rCykcAJorDUK48ECgYEA0TpkTwK6f2a72ncmw7Xzy4zdu+FdkI9PzWmS4IrbYOYRwsRMQLowsUPIdtU0EMrs7PRl1dSQa3/kAnw5J8wogkqVf4dJ3/lb/N5qtsjHP87N35QMXnMdE/BC6o7t5e+iRoHMloAuSBonGC9uBn1UeHWrNeLCB8+upJoSEBKbEQ0CgYEAzdSoKL4CJo31gVEqoJFPzPemsYGmV6Zl1Vj8mqMbQd8wcJoSJWbNV/3sfpIqdvOJOXQrzm+LYIbhhUnS3ZlGBmFsqUtC7dw3AqLg53msCyJLxmCIib0m/ONCY9qczV4OkUM6HVAdgzmMqqhk5ZB70IdUyStn2meqXKXLGFlLJKkCgYEAuizHTTcUVIFJ7x/PMp8ZjKqQM7pZ02Rykkm7FGr6wsJ2U2TwpTgIU/QI0RTt+3NWV5MxepBm4gEvFrcK9MrJ0QYk+RGdPttYay5Ors8B3Vlb//Jw/ypXWYKVSLpeHhiZwTuGnPT6OdZrqy2pLcUgAQBTlONt3B2FPZqLMBoeOZECgYBuCwm0bpF7x13AO4LMwaOmc6jdMfGa3s2G2MKEcjt6ZjbhnJ2i/Wk/Z/RuXvrxCZcN7nwVLDGZ88LSnftsmiuD8cZEZIZt4NRQRoBzgOtoMHfOoYGeElCr11yBQjme2nBzXTvOvCxrIfOAsfLvgOWRQSklPF2TuOSuD72bUPIJsQKBgBbeb8rIXKRRFC3A0IkKm8C51gG8mMgPdxZMKKuVhpb6D8B5aPh+WW44yNOpn7LInYI4jzf3Kv+kcj0PNH3nFaplnyCGFfmUIg27SAsRcrJcTlXtIKooZw6oPU+dQfAo11suArVAVD6OQc/7z99VoIpLN0cUHfS/g0H1dx/r/32o
258b8704-0587-4208-996f-96627992e370	80af2f23-4a51-498a-a011-732cf9cfa8f8	priority	100
12cd94c5-bd7e-4a5c-95e2-256b0bcf14bd	261e38de-3e1f-40a3-9200-f5aac1975701	allowed-protocol-mapper-types	oidc-address-mapper
f33b34f1-3793-4786-a281-b286fce52f45	261e38de-3e1f-40a3-9200-f5aac1975701	allowed-protocol-mapper-types	saml-role-list-mapper
d056c1de-9aa1-46a0-a644-fafb33088967	261e38de-3e1f-40a3-9200-f5aac1975701	allowed-protocol-mapper-types	saml-user-property-mapper
de895b7b-16e0-4f8e-95c4-055b4fd70c91	261e38de-3e1f-40a3-9200-f5aac1975701	allowed-protocol-mapper-types	saml-user-attribute-mapper
aec970eb-6722-4ed6-b8d3-4bbbfb2e3324	261e38de-3e1f-40a3-9200-f5aac1975701	allowed-protocol-mapper-types	oidc-usermodel-attribute-mapper
43020e0a-dac7-4255-9e30-b838279905d4	261e38de-3e1f-40a3-9200-f5aac1975701	allowed-protocol-mapper-types	oidc-usermodel-property-mapper
b8ec71f0-39a3-476d-baae-ee3632cadd2a	261e38de-3e1f-40a3-9200-f5aac1975701	allowed-protocol-mapper-types	oidc-full-name-mapper
7bbfd5ae-854e-42b6-ac26-017656bafa61	261e38de-3e1f-40a3-9200-f5aac1975701	allowed-protocol-mapper-types	oidc-sha256-pairwise-sub-mapper
07031bc1-b7b6-44b1-bdf7-8b9f5a31db40	3021f045-3220-4e56-872c-d3491f6601f6	max-clients	200
c9bba7d6-e8f7-46bd-9c58-15cf58860eae	cb7cf482-8ac6-4999-ab67-1d48fef549f5	allowed-protocol-mapper-types	saml-role-list-mapper
5c047fce-366d-4c39-8846-14a975a4dc07	cb7cf482-8ac6-4999-ab67-1d48fef549f5	allowed-protocol-mapper-types	saml-user-attribute-mapper
8961856f-6ae2-4e98-b372-0e9c18ee8e17	cb7cf482-8ac6-4999-ab67-1d48fef549f5	allowed-protocol-mapper-types	oidc-usermodel-attribute-mapper
79445172-82cc-46fd-97ef-059b9f75ea39	cb7cf482-8ac6-4999-ab67-1d48fef549f5	allowed-protocol-mapper-types	oidc-full-name-mapper
db4114c8-392d-427a-9e23-c430401cd93f	cb7cf482-8ac6-4999-ab67-1d48fef549f5	allowed-protocol-mapper-types	oidc-sha256-pairwise-sub-mapper
b52190d4-ee85-492b-9589-dbfee4afa60d	cb7cf482-8ac6-4999-ab67-1d48fef549f5	allowed-protocol-mapper-types	oidc-address-mapper
a0173a1b-dd1a-450c-8a6e-f2e1d7a5d3d8	cb7cf482-8ac6-4999-ab67-1d48fef549f5	allowed-protocol-mapper-types	saml-user-property-mapper
0e4535b0-2979-40f7-ad71-b57275cd0fdc	cb7cf482-8ac6-4999-ab67-1d48fef549f5	allowed-protocol-mapper-types	oidc-usermodel-property-mapper
aa3d34ee-58f9-4017-83ff-69f252d2b54b	4223e0de-8a82-464f-b466-048d3682d8df	allow-default-scopes	true
e77f7d11-31d8-468e-8232-cd5045556d23	5a1232c0-4243-454f-a26e-5d771efd3585	host-sending-registration-request-must-match	true
230d9d99-1b5c-49c5-853a-75967443a767	5a1232c0-4243-454f-a26e-5d771efd3585	client-uris-must-match	true
53a1ee77-7350-40cb-be63-6ac417f14e6f	7488860e-5bba-4f89-bde2-c63b0290cc0f	allow-default-scopes	true
\.


--
-- Data for Name: composite_role; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.composite_role (composite, child_role) FROM stdin;
4a3204aa-320e-4584-b8ee-ea2989b3f330	847ebc80-6849-4c47-9f9e-5bba0c0d754d
4a3204aa-320e-4584-b8ee-ea2989b3f330	103dc6a6-5e7a-4c27-b4f0-9dbb1fdcf214
4a3204aa-320e-4584-b8ee-ea2989b3f330	13c94e3b-b22f-4503-bc56-75e1bd2a927f
4a3204aa-320e-4584-b8ee-ea2989b3f330	4364a376-4ed0-4051-aeab-609f62420e5d
4a3204aa-320e-4584-b8ee-ea2989b3f330	f12af4b7-8828-47a5-abbc-dbb09b9d409e
4a3204aa-320e-4584-b8ee-ea2989b3f330	2606a5b9-699b-488a-a819-d6f368e66697
4a3204aa-320e-4584-b8ee-ea2989b3f330	2cf34980-2606-4faf-bc40-b9a47c69ef1c
4a3204aa-320e-4584-b8ee-ea2989b3f330	13e61c6b-aff6-4ef8-ab56-ad4abefcb101
4a3204aa-320e-4584-b8ee-ea2989b3f330	632bad74-a33f-4fd5-9393-ec0a07898b1a
4a3204aa-320e-4584-b8ee-ea2989b3f330	4607a008-f45c-45f5-b506-6de020b7e366
4a3204aa-320e-4584-b8ee-ea2989b3f330	edd471cc-81d5-43e4-bb43-41fe88ff537d
4a3204aa-320e-4584-b8ee-ea2989b3f330	4c2b4e2a-e792-4ffd-969d-e33ecdf7158f
4a3204aa-320e-4584-b8ee-ea2989b3f330	38282bc7-ea21-46db-a36e-ca621d3275b4
4a3204aa-320e-4584-b8ee-ea2989b3f330	12111f4a-16ee-4ee7-8576-7956b9440dc5
4a3204aa-320e-4584-b8ee-ea2989b3f330	f417ae21-5fb4-40fb-bda8-54c61ce7461d
4a3204aa-320e-4584-b8ee-ea2989b3f330	7adeaf33-05d3-4a81-a7bf-f99c721b5d9c
4a3204aa-320e-4584-b8ee-ea2989b3f330	60870d03-d96a-4371-bdad-e3fac925a8df
4a3204aa-320e-4584-b8ee-ea2989b3f330	94363dbd-a6b8-4678-8231-50208c32c22c
f12af4b7-8828-47a5-abbc-dbb09b9d409e	7adeaf33-05d3-4a81-a7bf-f99c721b5d9c
4364a376-4ed0-4051-aeab-609f62420e5d	f417ae21-5fb4-40fb-bda8-54c61ce7461d
4364a376-4ed0-4051-aeab-609f62420e5d	94363dbd-a6b8-4678-8231-50208c32c22c
619ba870-921e-4f28-b26c-89b11f39dddf	a42d235d-2864-4a99-9592-211d89d0407d
828c3ba8-a13d-49f5-8975-8eb00afbf7de	a1a08dbc-4553-4be7-85f5-88c417bdcd45
4a3204aa-320e-4584-b8ee-ea2989b3f330	b44e0fe0-0fb7-4e12-a6f0-b352431a0f57
4a3204aa-320e-4584-b8ee-ea2989b3f330	95dfed9c-47fe-489b-aa28-52f0d7aa7c49
4a3204aa-320e-4584-b8ee-ea2989b3f330	07e1586d-a943-46d9-9c3d-1f3544c8c27f
4a3204aa-320e-4584-b8ee-ea2989b3f330	293d0c06-6dce-4303-9cd3-dfdd6d1275b8
4a3204aa-320e-4584-b8ee-ea2989b3f330	cfdeeb7b-c70e-496b-9605-70377168a6cb
4a3204aa-320e-4584-b8ee-ea2989b3f330	74252705-a339-4513-97ca-d5617977d5ff
4a3204aa-320e-4584-b8ee-ea2989b3f330	77c3f67e-21d7-4c18-9971-4baf4c20eeaa
4a3204aa-320e-4584-b8ee-ea2989b3f330	5de01bf1-bfac-4ea2-8fb1-ed95594fe1da
4a3204aa-320e-4584-b8ee-ea2989b3f330	a72adc0b-5220-48e4-a66a-9e15dca5f574
4a3204aa-320e-4584-b8ee-ea2989b3f330	f29b8efa-3c08-410a-a5c0-15b52253d2e2
4a3204aa-320e-4584-b8ee-ea2989b3f330	dd3ecc72-aaee-43d5-8f7e-f6dcdfb5a608
4a3204aa-320e-4584-b8ee-ea2989b3f330	9d5a8bab-e112-4e1c-8196-604f3d0143ea
4a3204aa-320e-4584-b8ee-ea2989b3f330	ffff4251-e0a4-4f9c-8bf6-5461b2f52766
4a3204aa-320e-4584-b8ee-ea2989b3f330	5fafdde9-71f7-4f67-9c1d-f3f4bc7f5128
4a3204aa-320e-4584-b8ee-ea2989b3f330	6cfc2ac6-bdd7-4b90-ac16-27a75f2eb00a
4a3204aa-320e-4584-b8ee-ea2989b3f330	c3ded8eb-c970-4e43-bea9-5e07795d20ef
4a3204aa-320e-4584-b8ee-ea2989b3f330	811c2a39-6614-46fb-acf5-889d52248171
4a3204aa-320e-4584-b8ee-ea2989b3f330	2a90f228-2ca4-413f-bc4b-7939af8abcbf
cfdeeb7b-c70e-496b-9605-70377168a6cb	c3ded8eb-c970-4e43-bea9-5e07795d20ef
293d0c06-6dce-4303-9cd3-dfdd6d1275b8	2a90f228-2ca4-413f-bc4b-7939af8abcbf
293d0c06-6dce-4303-9cd3-dfdd6d1275b8	6cfc2ac6-bdd7-4b90-ac16-27a75f2eb00a
85afffb5-2069-4873-b6c8-08159c1e4bdd	d0e4028d-a604-427a-9262-a1a9513dafc8
85afffb5-2069-4873-b6c8-08159c1e4bdd	2b8b60c5-d388-4925-b735-858df38dae6e
85afffb5-2069-4873-b6c8-08159c1e4bdd	e9c997c8-ad6b-4a99-81e1-c248e94fbeac
85afffb5-2069-4873-b6c8-08159c1e4bdd	8c4449b9-5add-40ba-a19f-cf5d80425e68
85afffb5-2069-4873-b6c8-08159c1e4bdd	a5f31b90-986b-46d5-a385-a639b4e19e37
85afffb5-2069-4873-b6c8-08159c1e4bdd	99bd546f-a5ed-47f8-862c-9a5e8345bf3b
85afffb5-2069-4873-b6c8-08159c1e4bdd	9096d8df-9d5b-4fb5-b93e-49acc6df0be5
85afffb5-2069-4873-b6c8-08159c1e4bdd	03230264-ed7a-46b2-939d-53ebe9a59812
85afffb5-2069-4873-b6c8-08159c1e4bdd	2240d1de-5ac4-44ac-91be-cee70e1dd22b
85afffb5-2069-4873-b6c8-08159c1e4bdd	6d2fd708-445b-44a8-b950-f1350a15dd14
85afffb5-2069-4873-b6c8-08159c1e4bdd	82266aa3-67ea-485a-a078-4671eb141853
85afffb5-2069-4873-b6c8-08159c1e4bdd	d6dad388-8c69-4bba-940e-371afc98042e
85afffb5-2069-4873-b6c8-08159c1e4bdd	5d7868e1-0c4a-46cc-8bac-bd19c0ea1bde
85afffb5-2069-4873-b6c8-08159c1e4bdd	85e6229e-e246-4e9a-8b39-7bae49754f7d
85afffb5-2069-4873-b6c8-08159c1e4bdd	bc618c28-98d1-477d-b4fc-c5ec7cd7f271
85afffb5-2069-4873-b6c8-08159c1e4bdd	5059b239-0dce-4bb2-9c55-a6afc8dcbe3b
85afffb5-2069-4873-b6c8-08159c1e4bdd	ac28461f-3416-4af4-be65-abc739dbeee5
8c4449b9-5add-40ba-a19f-cf5d80425e68	bc618c28-98d1-477d-b4fc-c5ec7cd7f271
e9c997c8-ad6b-4a99-81e1-c248e94fbeac	ac28461f-3416-4af4-be65-abc739dbeee5
e9c997c8-ad6b-4a99-81e1-c248e94fbeac	85e6229e-e246-4e9a-8b39-7bae49754f7d
18a7066b-fe71-410e-9581-69f78347ec29	68fdbd76-8688-47a6-b68d-3298a5401f05
c7e799a5-1250-4bc8-b7c6-ffdc58361477	daaedcc6-e7a6-488e-921e-7022aa808da7
4a3204aa-320e-4584-b8ee-ea2989b3f330	b8a4faaf-86d9-43eb-bb18-0eaa654b35a7
85afffb5-2069-4873-b6c8-08159c1e4bdd	5e2301d7-2a9e-4f2d-a940-9bd442b15d8c
\.


--
-- Data for Name: credential; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.credential (id, salt, type, user_id, created_date, user_label, secret_data, credential_data, priority) FROM stdin;
d4b2c483-1dd3-47f6-86bf-42548009918d	\N	password	74e29604-ff35-42bb-a26d-4d0b81ef0917	1643820449817	\N	{"value":"Hou7HlbGvohOx6II0VSCP4BIGI4Cyzy+BcXbPUQe/kaMQzNU77kH2pOKZ236UPfkiCyOLe7A3oS0afExA+ymAQ==","salt":"urXvCw0KdWf9s74km4G+lA==","additionalParameters":{}}	{"hashIterations":27500,"algorithm":"pbkdf2-sha256","additionalParameters":{}}	10
cb2bd4ed-94b8-4259-bcaa-9250c3fb28d3	\N	password	6db3c5e5-b84b-4f9d-a7a8-8d05b03c929d	1657026827644	\N	{"value":"q3Z59Nh/5bdezDEpCwEbMPu8d+VgJ5WetafXkR8l0FlsTTkSDQgW+j6GaM3seJR93p3/jCxyfsvZl062d1pq7w==","salt":"ohuHnjLnwF9dBZ38DRJJWg==","additionalParameters":{}}	{"hashIterations":27500,"algorithm":"pbkdf2-sha256","additionalParameters":{}}	10
b58e1964-6466-40b2-879c-982b724d7f9c	\N	password	88692d07-bb9a-46cf-844c-7ff5c529cd04	1657026904515	\N	{"value":"+/0zWjiJyE3+dCOEf0SO6G3n1/LsFAVoDAZREKTfN4vQ5xJH8srJoCjxcgb+bI1crMr8gknDlFyGRy7CpYn2VQ==","salt":"v/2okNt3wGOZz+x4DjOCDQ==","additionalParameters":{}}	{"hashIterations":27500,"algorithm":"pbkdf2-sha256","additionalParameters":{}}	10
3ff7dd8f-a299-4b51-bf5d-99665ccfd313	\N	password	8f58cbec-6e40-4bab-bff0-1c5ff899fe2e	1657026943075	\N	{"value":"nMYodMJMiq/J8g9vRPktGc7WSWnOKr6leMDZX4p9K9KgAUYeXFDSu+d29PWWn0rFn93dL0PNdIdHWNQhfkIDMg==","salt":"rmi9WLHgarmIXGukecSIig==","additionalParameters":{}}	{"hashIterations":27500,"algorithm":"pbkdf2-sha256","additionalParameters":{}}	10
\.


--
-- Data for Name: databasechangelog; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.databasechangelog (id, author, filename, dateexecuted, orderexecuted, exectype, md5sum, description, comments, tag, liquibase, contexts, labels, deployment_id) FROM stdin;
1.0.0.Final-KEYCLOAK-5461	sthorger@redhat.com	META-INF/jpa-changelog-1.0.0.Final.xml	2022-02-02 16:47:26.017844	1	EXECUTED	7:4e70412f24a3f382c82183742ec79317	createTable tableName=APPLICATION_DEFAULT_ROLES; createTable tableName=CLIENT; createTable tableName=CLIENT_SESSION; createTable tableName=CLIENT_SESSION_ROLE; createTable tableName=COMPOSITE_ROLE; createTable tableName=CREDENTIAL; createTable tab...		\N	3.5.4	\N	\N	3820445829
1.0.0.Final-KEYCLOAK-5461	sthorger@redhat.com	META-INF/db2-jpa-changelog-1.0.0.Final.xml	2022-02-02 16:47:26.03122	2	MARK_RAN	7:cb16724583e9675711801c6875114f28	createTable tableName=APPLICATION_DEFAULT_ROLES; createTable tableName=CLIENT; createTable tableName=CLIENT_SESSION; createTable tableName=CLIENT_SESSION_ROLE; createTable tableName=COMPOSITE_ROLE; createTable tableName=CREDENTIAL; createTable tab...		\N	3.5.4	\N	\N	3820445829
1.1.0.Beta1	sthorger@redhat.com	META-INF/jpa-changelog-1.1.0.Beta1.xml	2022-02-02 16:47:26.06085	3	EXECUTED	7:0310eb8ba07cec616460794d42ade0fa	delete tableName=CLIENT_SESSION_ROLE; delete tableName=CLIENT_SESSION; delete tableName=USER_SESSION; createTable tableName=CLIENT_ATTRIBUTES; createTable tableName=CLIENT_SESSION_NOTE; createTable tableName=APP_NODE_REGISTRATIONS; addColumn table...		\N	3.5.4	\N	\N	3820445829
1.1.0.Final	sthorger@redhat.com	META-INF/jpa-changelog-1.1.0.Final.xml	2022-02-02 16:47:26.065284	4	EXECUTED	7:5d25857e708c3233ef4439df1f93f012	renameColumn newColumnName=EVENT_TIME, oldColumnName=TIME, tableName=EVENT_ENTITY		\N	3.5.4	\N	\N	3820445829
1.2.0.Beta1	psilva@redhat.com	META-INF/jpa-changelog-1.2.0.Beta1.xml	2022-02-02 16:47:26.130908	5	EXECUTED	7:c7a54a1041d58eb3817a4a883b4d4e84	delete tableName=CLIENT_SESSION_ROLE; delete tableName=CLIENT_SESSION_NOTE; delete tableName=CLIENT_SESSION; delete tableName=USER_SESSION; createTable tableName=PROTOCOL_MAPPER; createTable tableName=PROTOCOL_MAPPER_CONFIG; createTable tableName=...		\N	3.5.4	\N	\N	3820445829
1.2.0.Beta1	psilva@redhat.com	META-INF/db2-jpa-changelog-1.2.0.Beta1.xml	2022-02-02 16:47:26.133863	6	MARK_RAN	7:2e01012df20974c1c2a605ef8afe25b7	delete tableName=CLIENT_SESSION_ROLE; delete tableName=CLIENT_SESSION_NOTE; delete tableName=CLIENT_SESSION; delete tableName=USER_SESSION; createTable tableName=PROTOCOL_MAPPER; createTable tableName=PROTOCOL_MAPPER_CONFIG; createTable tableName=...		\N	3.5.4	\N	\N	3820445829
1.2.0.RC1	bburke@redhat.com	META-INF/jpa-changelog-1.2.0.CR1.xml	2022-02-02 16:47:26.183318	7	EXECUTED	7:0f08df48468428e0f30ee59a8ec01a41	delete tableName=CLIENT_SESSION_ROLE; delete tableName=CLIENT_SESSION_NOTE; delete tableName=CLIENT_SESSION; delete tableName=USER_SESSION_NOTE; delete tableName=USER_SESSION; createTable tableName=MIGRATION_MODEL; createTable tableName=IDENTITY_P...		\N	3.5.4	\N	\N	3820445829
1.2.0.RC1	bburke@redhat.com	META-INF/db2-jpa-changelog-1.2.0.CR1.xml	2022-02-02 16:47:26.186858	8	MARK_RAN	7:a77ea2ad226b345e7d689d366f185c8c	delete tableName=CLIENT_SESSION_ROLE; delete tableName=CLIENT_SESSION_NOTE; delete tableName=CLIENT_SESSION; delete tableName=USER_SESSION_NOTE; delete tableName=USER_SESSION; createTable tableName=MIGRATION_MODEL; createTable tableName=IDENTITY_P...		\N	3.5.4	\N	\N	3820445829
1.2.0.Final	keycloak	META-INF/jpa-changelog-1.2.0.Final.xml	2022-02-02 16:47:26.19172	9	EXECUTED	7:a3377a2059aefbf3b90ebb4c4cc8e2ab	update tableName=CLIENT; update tableName=CLIENT; update tableName=CLIENT		\N	3.5.4	\N	\N	3820445829
1.3.0	bburke@redhat.com	META-INF/jpa-changelog-1.3.0.xml	2022-02-02 16:47:26.242162	10	EXECUTED	7:04c1dbedc2aa3e9756d1a1668e003451	delete tableName=CLIENT_SESSION_ROLE; delete tableName=CLIENT_SESSION_PROT_MAPPER; delete tableName=CLIENT_SESSION_NOTE; delete tableName=CLIENT_SESSION; delete tableName=USER_SESSION_NOTE; delete tableName=USER_SESSION; createTable tableName=ADMI...		\N	3.5.4	\N	\N	3820445829
1.4.0	bburke@redhat.com	META-INF/jpa-changelog-1.4.0.xml	2022-02-02 16:47:26.275929	11	EXECUTED	7:36ef39ed560ad07062d956db861042ba	delete tableName=CLIENT_SESSION_AUTH_STATUS; delete tableName=CLIENT_SESSION_ROLE; delete tableName=CLIENT_SESSION_PROT_MAPPER; delete tableName=CLIENT_SESSION_NOTE; delete tableName=CLIENT_SESSION; delete tableName=USER_SESSION_NOTE; delete table...		\N	3.5.4	\N	\N	3820445829
1.4.0	bburke@redhat.com	META-INF/db2-jpa-changelog-1.4.0.xml	2022-02-02 16:47:26.278548	12	MARK_RAN	7:d909180b2530479a716d3f9c9eaea3d7	delete tableName=CLIENT_SESSION_AUTH_STATUS; delete tableName=CLIENT_SESSION_ROLE; delete tableName=CLIENT_SESSION_PROT_MAPPER; delete tableName=CLIENT_SESSION_NOTE; delete tableName=CLIENT_SESSION; delete tableName=USER_SESSION_NOTE; delete table...		\N	3.5.4	\N	\N	3820445829
1.5.0	bburke@redhat.com	META-INF/jpa-changelog-1.5.0.xml	2022-02-02 16:47:26.287616	13	EXECUTED	7:cf12b04b79bea5152f165eb41f3955f6	delete tableName=CLIENT_SESSION_AUTH_STATUS; delete tableName=CLIENT_SESSION_ROLE; delete tableName=CLIENT_SESSION_PROT_MAPPER; delete tableName=CLIENT_SESSION_NOTE; delete tableName=CLIENT_SESSION; delete tableName=USER_SESSION_NOTE; delete table...		\N	3.5.4	\N	\N	3820445829
1.6.1_from15	mposolda@redhat.com	META-INF/jpa-changelog-1.6.1.xml	2022-02-02 16:47:26.299798	14	EXECUTED	7:7e32c8f05c755e8675764e7d5f514509	addColumn tableName=REALM; addColumn tableName=KEYCLOAK_ROLE; addColumn tableName=CLIENT; createTable tableName=OFFLINE_USER_SESSION; createTable tableName=OFFLINE_CLIENT_SESSION; addPrimaryKey constraintName=CONSTRAINT_OFFL_US_SES_PK2, tableName=...		\N	3.5.4	\N	\N	3820445829
1.6.1_from16-pre	mposolda@redhat.com	META-INF/jpa-changelog-1.6.1.xml	2022-02-02 16:47:26.302088	15	MARK_RAN	7:980ba23cc0ec39cab731ce903dd01291	delete tableName=OFFLINE_CLIENT_SESSION; delete tableName=OFFLINE_USER_SESSION		\N	3.5.4	\N	\N	3820445829
1.6.1_from16	mposolda@redhat.com	META-INF/jpa-changelog-1.6.1.xml	2022-02-02 16:47:26.303889	16	MARK_RAN	7:2fa220758991285312eb84f3b4ff5336	dropPrimaryKey constraintName=CONSTRAINT_OFFLINE_US_SES_PK, tableName=OFFLINE_USER_SESSION; dropPrimaryKey constraintName=CONSTRAINT_OFFLINE_CL_SES_PK, tableName=OFFLINE_CLIENT_SESSION; addColumn tableName=OFFLINE_USER_SESSION; update tableName=OF...		\N	3.5.4	\N	\N	3820445829
1.6.1	mposolda@redhat.com	META-INF/jpa-changelog-1.6.1.xml	2022-02-02 16:47:26.306641	17	EXECUTED	7:d41d8cd98f00b204e9800998ecf8427e	empty		\N	3.5.4	\N	\N	3820445829
1.7.0	bburke@redhat.com	META-INF/jpa-changelog-1.7.0.xml	2022-02-02 16:47:26.338791	18	EXECUTED	7:91ace540896df890cc00a0490ee52bbc	createTable tableName=KEYCLOAK_GROUP; createTable tableName=GROUP_ROLE_MAPPING; createTable tableName=GROUP_ATTRIBUTE; createTable tableName=USER_GROUP_MEMBERSHIP; createTable tableName=REALM_DEFAULT_GROUPS; addColumn tableName=IDENTITY_PROVIDER; ...		\N	3.5.4	\N	\N	3820445829
1.8.0	mposolda@redhat.com	META-INF/jpa-changelog-1.8.0.xml	2022-02-02 16:47:26.381463	19	EXECUTED	7:c31d1646dfa2618a9335c00e07f89f24	addColumn tableName=IDENTITY_PROVIDER; createTable tableName=CLIENT_TEMPLATE; createTable tableName=CLIENT_TEMPLATE_ATTRIBUTES; createTable tableName=TEMPLATE_SCOPE_MAPPING; dropNotNullConstraint columnName=CLIENT_ID, tableName=PROTOCOL_MAPPER; ad...		\N	3.5.4	\N	\N	3820445829
1.8.0-2	keycloak	META-INF/jpa-changelog-1.8.0.xml	2022-02-02 16:47:26.390165	20	EXECUTED	7:df8bc21027a4f7cbbb01f6344e89ce07	dropDefaultValue columnName=ALGORITHM, tableName=CREDENTIAL; update tableName=CREDENTIAL		\N	3.5.4	\N	\N	3820445829
authz-3.4.0.CR1-resource-server-pk-change-part1	glavoie@gmail.com	META-INF/jpa-changelog-authz-3.4.0.CR1.xml	2022-02-02 16:47:26.679075	45	EXECUTED	7:6a48ce645a3525488a90fbf76adf3bb3	addColumn tableName=RESOURCE_SERVER_POLICY; addColumn tableName=RESOURCE_SERVER_RESOURCE; addColumn tableName=RESOURCE_SERVER_SCOPE		\N	3.5.4	\N	\N	3820445829
1.8.0	mposolda@redhat.com	META-INF/db2-jpa-changelog-1.8.0.xml	2022-02-02 16:47:26.392862	21	MARK_RAN	7:f987971fe6b37d963bc95fee2b27f8df	addColumn tableName=IDENTITY_PROVIDER; createTable tableName=CLIENT_TEMPLATE; createTable tableName=CLIENT_TEMPLATE_ATTRIBUTES; createTable tableName=TEMPLATE_SCOPE_MAPPING; dropNotNullConstraint columnName=CLIENT_ID, tableName=PROTOCOL_MAPPER; ad...		\N	3.5.4	\N	\N	3820445829
1.8.0-2	keycloak	META-INF/db2-jpa-changelog-1.8.0.xml	2022-02-02 16:47:26.395652	22	MARK_RAN	7:df8bc21027a4f7cbbb01f6344e89ce07	dropDefaultValue columnName=ALGORITHM, tableName=CREDENTIAL; update tableName=CREDENTIAL		\N	3.5.4	\N	\N	3820445829
1.9.0	mposolda@redhat.com	META-INF/jpa-changelog-1.9.0.xml	2022-02-02 16:47:26.40969	23	EXECUTED	7:ed2dc7f799d19ac452cbcda56c929e47	update tableName=REALM; update tableName=REALM; update tableName=REALM; update tableName=REALM; update tableName=CREDENTIAL; update tableName=CREDENTIAL; update tableName=CREDENTIAL; update tableName=REALM; update tableName=REALM; customChange; dr...		\N	3.5.4	\N	\N	3820445829
1.9.1	keycloak	META-INF/jpa-changelog-1.9.1.xml	2022-02-02 16:47:26.414344	24	EXECUTED	7:80b5db88a5dda36ece5f235be8757615	modifyDataType columnName=PRIVATE_KEY, tableName=REALM; modifyDataType columnName=PUBLIC_KEY, tableName=REALM; modifyDataType columnName=CERTIFICATE, tableName=REALM		\N	3.5.4	\N	\N	3820445829
1.9.1	keycloak	META-INF/db2-jpa-changelog-1.9.1.xml	2022-02-02 16:47:26.416193	25	MARK_RAN	7:1437310ed1305a9b93f8848f301726ce	modifyDataType columnName=PRIVATE_KEY, tableName=REALM; modifyDataType columnName=CERTIFICATE, tableName=REALM		\N	3.5.4	\N	\N	3820445829
1.9.2	keycloak	META-INF/jpa-changelog-1.9.2.xml	2022-02-02 16:47:26.437367	26	EXECUTED	7:b82ffb34850fa0836be16deefc6a87c4	createIndex indexName=IDX_USER_EMAIL, tableName=USER_ENTITY; createIndex indexName=IDX_USER_ROLE_MAPPING, tableName=USER_ROLE_MAPPING; createIndex indexName=IDX_USER_GROUP_MAPPING, tableName=USER_GROUP_MEMBERSHIP; createIndex indexName=IDX_USER_CO...		\N	3.5.4	\N	\N	3820445829
authz-2.0.0	psilva@redhat.com	META-INF/jpa-changelog-authz-2.0.0.xml	2022-02-02 16:47:26.481647	27	EXECUTED	7:9cc98082921330d8d9266decdd4bd658	createTable tableName=RESOURCE_SERVER; addPrimaryKey constraintName=CONSTRAINT_FARS, tableName=RESOURCE_SERVER; addUniqueConstraint constraintName=UK_AU8TT6T700S9V50BU18WS5HA6, tableName=RESOURCE_SERVER; createTable tableName=RESOURCE_SERVER_RESOU...		\N	3.5.4	\N	\N	3820445829
authz-2.5.1	psilva@redhat.com	META-INF/jpa-changelog-authz-2.5.1.xml	2022-02-02 16:47:26.484459	28	EXECUTED	7:03d64aeed9cb52b969bd30a7ac0db57e	update tableName=RESOURCE_SERVER_POLICY		\N	3.5.4	\N	\N	3820445829
2.1.0-KEYCLOAK-5461	bburke@redhat.com	META-INF/jpa-changelog-2.1.0.xml	2022-02-02 16:47:26.523006	29	EXECUTED	7:f1f9fd8710399d725b780f463c6b21cd	createTable tableName=BROKER_LINK; createTable tableName=FED_USER_ATTRIBUTE; createTable tableName=FED_USER_CONSENT; createTable tableName=FED_USER_CONSENT_ROLE; createTable tableName=FED_USER_CONSENT_PROT_MAPPER; createTable tableName=FED_USER_CR...		\N	3.5.4	\N	\N	3820445829
2.2.0	bburke@redhat.com	META-INF/jpa-changelog-2.2.0.xml	2022-02-02 16:47:26.532066	30	EXECUTED	7:53188c3eb1107546e6f765835705b6c1	addColumn tableName=ADMIN_EVENT_ENTITY; createTable tableName=CREDENTIAL_ATTRIBUTE; createTable tableName=FED_CREDENTIAL_ATTRIBUTE; modifyDataType columnName=VALUE, tableName=CREDENTIAL; addForeignKeyConstraint baseTableName=FED_CREDENTIAL_ATTRIBU...		\N	3.5.4	\N	\N	3820445829
2.3.0	bburke@redhat.com	META-INF/jpa-changelog-2.3.0.xml	2022-02-02 16:47:26.541837	31	EXECUTED	7:d6e6f3bc57a0c5586737d1351725d4d4	createTable tableName=FEDERATED_USER; addPrimaryKey constraintName=CONSTR_FEDERATED_USER, tableName=FEDERATED_USER; dropDefaultValue columnName=TOTP, tableName=USER_ENTITY; dropColumn columnName=TOTP, tableName=USER_ENTITY; addColumn tableName=IDE...		\N	3.5.4	\N	\N	3820445829
2.4.0	bburke@redhat.com	META-INF/jpa-changelog-2.4.0.xml	2022-02-02 16:47:26.545809	32	EXECUTED	7:454d604fbd755d9df3fd9c6329043aa5	customChange		\N	3.5.4	\N	\N	3820445829
2.5.0	bburke@redhat.com	META-INF/jpa-changelog-2.5.0.xml	2022-02-02 16:47:26.549823	33	EXECUTED	7:57e98a3077e29caf562f7dbf80c72600	customChange; modifyDataType columnName=USER_ID, tableName=OFFLINE_USER_SESSION		\N	3.5.4	\N	\N	3820445829
2.5.0-unicode-oracle	hmlnarik@redhat.com	META-INF/jpa-changelog-2.5.0.xml	2022-02-02 16:47:26.55176	34	MARK_RAN	7:e4c7e8f2256210aee71ddc42f538b57a	modifyDataType columnName=DESCRIPTION, tableName=AUTHENTICATION_FLOW; modifyDataType columnName=DESCRIPTION, tableName=CLIENT_TEMPLATE; modifyDataType columnName=DESCRIPTION, tableName=RESOURCE_SERVER_POLICY; modifyDataType columnName=DESCRIPTION,...		\N	3.5.4	\N	\N	3820445829
2.5.0-unicode-other-dbs	hmlnarik@redhat.com	META-INF/jpa-changelog-2.5.0.xml	2022-02-02 16:47:26.567305	35	EXECUTED	7:09a43c97e49bc626460480aa1379b522	modifyDataType columnName=DESCRIPTION, tableName=AUTHENTICATION_FLOW; modifyDataType columnName=DESCRIPTION, tableName=CLIENT_TEMPLATE; modifyDataType columnName=DESCRIPTION, tableName=RESOURCE_SERVER_POLICY; modifyDataType columnName=DESCRIPTION,...		\N	3.5.4	\N	\N	3820445829
2.5.0-duplicate-email-support	slawomir@dabek.name	META-INF/jpa-changelog-2.5.0.xml	2022-02-02 16:47:26.570727	36	EXECUTED	7:26bfc7c74fefa9126f2ce702fb775553	addColumn tableName=REALM		\N	3.5.4	\N	\N	3820445829
2.5.0-unique-group-names	hmlnarik@redhat.com	META-INF/jpa-changelog-2.5.0.xml	2022-02-02 16:47:26.578396	37	EXECUTED	7:a161e2ae671a9020fff61e996a207377	addUniqueConstraint constraintName=SIBLING_NAMES, tableName=KEYCLOAK_GROUP		\N	3.5.4	\N	\N	3820445829
2.5.1	bburke@redhat.com	META-INF/jpa-changelog-2.5.1.xml	2022-02-02 16:47:26.581391	38	EXECUTED	7:37fc1781855ac5388c494f1442b3f717	addColumn tableName=FED_USER_CONSENT		\N	3.5.4	\N	\N	3820445829
3.0.0	bburke@redhat.com	META-INF/jpa-changelog-3.0.0.xml	2022-02-02 16:47:26.584204	39	EXECUTED	7:13a27db0dae6049541136adad7261d27	addColumn tableName=IDENTITY_PROVIDER		\N	3.5.4	\N	\N	3820445829
3.2.0-fix	keycloak	META-INF/jpa-changelog-3.2.0.xml	2022-02-02 16:47:26.585877	40	MARK_RAN	7:550300617e3b59e8af3a6294df8248a3	addNotNullConstraint columnName=REALM_ID, tableName=CLIENT_INITIAL_ACCESS		\N	3.5.4	\N	\N	3820445829
3.2.0-fix-with-keycloak-5416	keycloak	META-INF/jpa-changelog-3.2.0.xml	2022-02-02 16:47:26.587657	41	MARK_RAN	7:e3a9482b8931481dc2772a5c07c44f17	dropIndex indexName=IDX_CLIENT_INIT_ACC_REALM, tableName=CLIENT_INITIAL_ACCESS; addNotNullConstraint columnName=REALM_ID, tableName=CLIENT_INITIAL_ACCESS; createIndex indexName=IDX_CLIENT_INIT_ACC_REALM, tableName=CLIENT_INITIAL_ACCESS		\N	3.5.4	\N	\N	3820445829
3.2.0-fix-offline-sessions	hmlnarik	META-INF/jpa-changelog-3.2.0.xml	2022-02-02 16:47:26.591561	42	EXECUTED	7:72b07d85a2677cb257edb02b408f332d	customChange		\N	3.5.4	\N	\N	3820445829
3.2.0-fixed	keycloak	META-INF/jpa-changelog-3.2.0.xml	2022-02-02 16:47:26.669981	43	EXECUTED	7:a72a7858967bd414835d19e04d880312	addColumn tableName=REALM; dropPrimaryKey constraintName=CONSTRAINT_OFFL_CL_SES_PK2, tableName=OFFLINE_CLIENT_SESSION; dropColumn columnName=CLIENT_SESSION_ID, tableName=OFFLINE_CLIENT_SESSION; addPrimaryKey constraintName=CONSTRAINT_OFFL_CL_SES_P...		\N	3.5.4	\N	\N	3820445829
3.3.0	keycloak	META-INF/jpa-changelog-3.3.0.xml	2022-02-02 16:47:26.673701	44	EXECUTED	7:94edff7cf9ce179e7e85f0cd78a3cf2c	addColumn tableName=USER_ENTITY		\N	3.5.4	\N	\N	3820445829
authz-3.4.0.CR1-resource-server-pk-change-part2-KEYCLOAK-6095	hmlnarik@redhat.com	META-INF/jpa-changelog-authz-3.4.0.CR1.xml	2022-02-02 16:47:26.681987	46	EXECUTED	7:e64b5dcea7db06077c6e57d3b9e5ca14	customChange		\N	3.5.4	\N	\N	3820445829
authz-3.4.0.CR1-resource-server-pk-change-part3-fixed	glavoie@gmail.com	META-INF/jpa-changelog-authz-3.4.0.CR1.xml	2022-02-02 16:47:26.683661	47	MARK_RAN	7:fd8cf02498f8b1e72496a20afc75178c	dropIndex indexName=IDX_RES_SERV_POL_RES_SERV, tableName=RESOURCE_SERVER_POLICY; dropIndex indexName=IDX_RES_SRV_RES_RES_SRV, tableName=RESOURCE_SERVER_RESOURCE; dropIndex indexName=IDX_RES_SRV_SCOPE_RES_SRV, tableName=RESOURCE_SERVER_SCOPE		\N	3.5.4	\N	\N	3820445829
authz-3.4.0.CR1-resource-server-pk-change-part3-fixed-nodropindex	glavoie@gmail.com	META-INF/jpa-changelog-authz-3.4.0.CR1.xml	2022-02-02 16:47:26.702743	48	EXECUTED	7:542794f25aa2b1fbabb7e577d6646319	addNotNullConstraint columnName=RESOURCE_SERVER_CLIENT_ID, tableName=RESOURCE_SERVER_POLICY; addNotNullConstraint columnName=RESOURCE_SERVER_CLIENT_ID, tableName=RESOURCE_SERVER_RESOURCE; addNotNullConstraint columnName=RESOURCE_SERVER_CLIENT_ID, ...		\N	3.5.4	\N	\N	3820445829
authn-3.4.0.CR1-refresh-token-max-reuse	glavoie@gmail.com	META-INF/jpa-changelog-authz-3.4.0.CR1.xml	2022-02-02 16:47:26.706593	49	EXECUTED	7:edad604c882df12f74941dac3cc6d650	addColumn tableName=REALM		\N	3.5.4	\N	\N	3820445829
3.4.0	keycloak	META-INF/jpa-changelog-3.4.0.xml	2022-02-02 16:47:26.734467	50	EXECUTED	7:0f88b78b7b46480eb92690cbf5e44900	addPrimaryKey constraintName=CONSTRAINT_REALM_DEFAULT_ROLES, tableName=REALM_DEFAULT_ROLES; addPrimaryKey constraintName=CONSTRAINT_COMPOSITE_ROLE, tableName=COMPOSITE_ROLE; addPrimaryKey constraintName=CONSTR_REALM_DEFAULT_GROUPS, tableName=REALM...		\N	3.5.4	\N	\N	3820445829
3.4.0-KEYCLOAK-5230	hmlnarik@redhat.com	META-INF/jpa-changelog-3.4.0.xml	2022-02-02 16:47:26.78037	51	EXECUTED	7:d560e43982611d936457c327f872dd59	createIndex indexName=IDX_FU_ATTRIBUTE, tableName=FED_USER_ATTRIBUTE; createIndex indexName=IDX_FU_CONSENT, tableName=FED_USER_CONSENT; createIndex indexName=IDX_FU_CONSENT_RU, tableName=FED_USER_CONSENT; createIndex indexName=IDX_FU_CREDENTIAL, t...		\N	3.5.4	\N	\N	3820445829
3.4.1	psilva@redhat.com	META-INF/jpa-changelog-3.4.1.xml	2022-02-02 16:47:26.783989	52	EXECUTED	7:c155566c42b4d14ef07059ec3b3bbd8e	modifyDataType columnName=VALUE, tableName=CLIENT_ATTRIBUTES		\N	3.5.4	\N	\N	3820445829
3.4.2	keycloak	META-INF/jpa-changelog-3.4.2.xml	2022-02-02 16:47:26.786619	53	EXECUTED	7:b40376581f12d70f3c89ba8ddf5b7dea	update tableName=REALM		\N	3.5.4	\N	\N	3820445829
3.4.2-KEYCLOAK-5172	mkanis@redhat.com	META-INF/jpa-changelog-3.4.2.xml	2022-02-02 16:47:26.788788	54	EXECUTED	7:a1132cc395f7b95b3646146c2e38f168	update tableName=CLIENT		\N	3.5.4	\N	\N	3820445829
4.0.0-KEYCLOAK-6335	bburke@redhat.com	META-INF/jpa-changelog-4.0.0.xml	2022-02-02 16:47:26.794881	55	EXECUTED	7:d8dc5d89c789105cfa7ca0e82cba60af	createTable tableName=CLIENT_AUTH_FLOW_BINDINGS; addPrimaryKey constraintName=C_CLI_FLOW_BIND, tableName=CLIENT_AUTH_FLOW_BINDINGS		\N	3.5.4	\N	\N	3820445829
4.0.0-CLEANUP-UNUSED-TABLE	bburke@redhat.com	META-INF/jpa-changelog-4.0.0.xml	2022-02-02 16:47:26.799493	56	EXECUTED	7:7822e0165097182e8f653c35517656a3	dropTable tableName=CLIENT_IDENTITY_PROV_MAPPING		\N	3.5.4	\N	\N	3820445829
4.0.0-KEYCLOAK-6228	bburke@redhat.com	META-INF/jpa-changelog-4.0.0.xml	2022-02-02 16:47:26.810686	57	EXECUTED	7:c6538c29b9c9a08f9e9ea2de5c2b6375	dropUniqueConstraint constraintName=UK_JKUWUVD56ONTGSUHOGM8UEWRT, tableName=USER_CONSENT; dropNotNullConstraint columnName=CLIENT_ID, tableName=USER_CONSENT; addColumn tableName=USER_CONSENT; addUniqueConstraint constraintName=UK_JKUWUVD56ONTGSUHO...		\N	3.5.4	\N	\N	3820445829
4.0.0-KEYCLOAK-5579-fixed	mposolda@redhat.com	META-INF/jpa-changelog-4.0.0.xml	2022-02-02 16:47:26.861332	58	EXECUTED	7:6d4893e36de22369cf73bcb051ded875	dropForeignKeyConstraint baseTableName=CLIENT_TEMPLATE_ATTRIBUTES, constraintName=FK_CL_TEMPL_ATTR_TEMPL; renameTable newTableName=CLIENT_SCOPE_ATTRIBUTES, oldTableName=CLIENT_TEMPLATE_ATTRIBUTES; renameColumn newColumnName=SCOPE_ID, oldColumnName...		\N	3.5.4	\N	\N	3820445829
authz-4.0.0.CR1	psilva@redhat.com	META-INF/jpa-changelog-authz-4.0.0.CR1.xml	2022-02-02 16:47:26.877018	59	EXECUTED	7:57960fc0b0f0dd0563ea6f8b2e4a1707	createTable tableName=RESOURCE_SERVER_PERM_TICKET; addPrimaryKey constraintName=CONSTRAINT_FAPMT, tableName=RESOURCE_SERVER_PERM_TICKET; addForeignKeyConstraint baseTableName=RESOURCE_SERVER_PERM_TICKET, constraintName=FK_FRSRHO213XCX4WNKOG82SSPMT...		\N	3.5.4	\N	\N	3820445829
authz-4.0.0.Beta3	psilva@redhat.com	META-INF/jpa-changelog-authz-4.0.0.Beta3.xml	2022-02-02 16:47:26.881203	60	EXECUTED	7:2b4b8bff39944c7097977cc18dbceb3b	addColumn tableName=RESOURCE_SERVER_POLICY; addColumn tableName=RESOURCE_SERVER_PERM_TICKET; addForeignKeyConstraint baseTableName=RESOURCE_SERVER_PERM_TICKET, constraintName=FK_FRSRPO2128CX4WNKOG82SSRFY, referencedTableName=RESOURCE_SERVER_POLICY		\N	3.5.4	\N	\N	3820445829
authz-4.2.0.Final	mhajas@redhat.com	META-INF/jpa-changelog-authz-4.2.0.Final.xml	2022-02-02 16:47:26.886177	61	EXECUTED	7:2aa42a964c59cd5b8ca9822340ba33a8	createTable tableName=RESOURCE_URIS; addForeignKeyConstraint baseTableName=RESOURCE_URIS, constraintName=FK_RESOURCE_SERVER_URIS, referencedTableName=RESOURCE_SERVER_RESOURCE; customChange; dropColumn columnName=URI, tableName=RESOURCE_SERVER_RESO...		\N	3.5.4	\N	\N	3820445829
authz-4.2.0.Final-KEYCLOAK-9944	hmlnarik@redhat.com	META-INF/jpa-changelog-authz-4.2.0.Final.xml	2022-02-02 16:47:26.890482	62	EXECUTED	7:9ac9e58545479929ba23f4a3087a0346	addPrimaryKey constraintName=CONSTRAINT_RESOUR_URIS_PK, tableName=RESOURCE_URIS		\N	3.5.4	\N	\N	3820445829
4.2.0-KEYCLOAK-6313	wadahiro@gmail.com	META-INF/jpa-changelog-4.2.0.xml	2022-02-02 16:47:26.893518	63	EXECUTED	7:14d407c35bc4fe1976867756bcea0c36	addColumn tableName=REQUIRED_ACTION_PROVIDER		\N	3.5.4	\N	\N	3820445829
4.3.0-KEYCLOAK-7984	wadahiro@gmail.com	META-INF/jpa-changelog-4.3.0.xml	2022-02-02 16:47:26.895621	64	EXECUTED	7:241a8030c748c8548e346adee548fa93	update tableName=REQUIRED_ACTION_PROVIDER		\N	3.5.4	\N	\N	3820445829
4.6.0-KEYCLOAK-7950	psilva@redhat.com	META-INF/jpa-changelog-4.6.0.xml	2022-02-02 16:47:26.89756	65	EXECUTED	7:7d3182f65a34fcc61e8d23def037dc3f	update tableName=RESOURCE_SERVER_RESOURCE		\N	3.5.4	\N	\N	3820445829
4.6.0-KEYCLOAK-8377	keycloak	META-INF/jpa-changelog-4.6.0.xml	2022-02-02 16:47:26.908059	66	EXECUTED	7:b30039e00a0b9715d430d1b0636728fa	createTable tableName=ROLE_ATTRIBUTE; addPrimaryKey constraintName=CONSTRAINT_ROLE_ATTRIBUTE_PK, tableName=ROLE_ATTRIBUTE; addForeignKeyConstraint baseTableName=ROLE_ATTRIBUTE, constraintName=FK_ROLE_ATTRIBUTE_ID, referencedTableName=KEYCLOAK_ROLE...		\N	3.5.4	\N	\N	3820445829
4.6.0-KEYCLOAK-8555	gideonray@gmail.com	META-INF/jpa-changelog-4.6.0.xml	2022-02-02 16:47:26.912693	67	EXECUTED	7:3797315ca61d531780f8e6f82f258159	createIndex indexName=IDX_COMPONENT_PROVIDER_TYPE, tableName=COMPONENT		\N	3.5.4	\N	\N	3820445829
4.7.0-KEYCLOAK-1267	sguilhen@redhat.com	META-INF/jpa-changelog-4.7.0.xml	2022-02-02 16:47:26.915771	68	EXECUTED	7:c7aa4c8d9573500c2d347c1941ff0301	addColumn tableName=REALM		\N	3.5.4	\N	\N	3820445829
4.7.0-KEYCLOAK-7275	keycloak	META-INF/jpa-changelog-4.7.0.xml	2022-02-02 16:47:26.924465	69	EXECUTED	7:b207faee394fc074a442ecd42185a5dd	renameColumn newColumnName=CREATED_ON, oldColumnName=LAST_SESSION_REFRESH, tableName=OFFLINE_USER_SESSION; addNotNullConstraint columnName=CREATED_ON, tableName=OFFLINE_USER_SESSION; addColumn tableName=OFFLINE_USER_SESSION; customChange; createIn...		\N	3.5.4	\N	\N	3820445829
4.8.0-KEYCLOAK-8835	sguilhen@redhat.com	META-INF/jpa-changelog-4.8.0.xml	2022-02-02 16:47:26.928034	70	EXECUTED	7:ab9a9762faaba4ddfa35514b212c4922	addNotNullConstraint columnName=SSO_MAX_LIFESPAN_REMEMBER_ME, tableName=REALM; addNotNullConstraint columnName=SSO_IDLE_TIMEOUT_REMEMBER_ME, tableName=REALM		\N	3.5.4	\N	\N	3820445829
authz-7.0.0-KEYCLOAK-10443	psilva@redhat.com	META-INF/jpa-changelog-authz-7.0.0.xml	2022-02-02 16:47:26.93061	71	EXECUTED	7:b9710f74515a6ccb51b72dc0d19df8c4	addColumn tableName=RESOURCE_SERVER		\N	3.5.4	\N	\N	3820445829
8.0.0-adding-credential-columns	keycloak	META-INF/jpa-changelog-8.0.0.xml	2022-02-02 16:47:26.933771	72	EXECUTED	7:ec9707ae4d4f0b7452fee20128083879	addColumn tableName=CREDENTIAL; addColumn tableName=FED_USER_CREDENTIAL		\N	3.5.4	\N	\N	3820445829
8.0.0-updating-credential-data-not-oracle	keycloak	META-INF/jpa-changelog-8.0.0.xml	2022-02-02 16:47:26.937673	73	EXECUTED	7:03b3f4b264c3c68ba082250a80b74216	update tableName=CREDENTIAL; update tableName=CREDENTIAL; update tableName=CREDENTIAL; update tableName=FED_USER_CREDENTIAL; update tableName=FED_USER_CREDENTIAL; update tableName=FED_USER_CREDENTIAL		\N	3.5.4	\N	\N	3820445829
8.0.0-updating-credential-data-oracle	keycloak	META-INF/jpa-changelog-8.0.0.xml	2022-02-02 16:47:26.939218	74	MARK_RAN	7:64c5728f5ca1f5aa4392217701c4fe23	update tableName=CREDENTIAL; update tableName=CREDENTIAL; update tableName=CREDENTIAL; update tableName=FED_USER_CREDENTIAL; update tableName=FED_USER_CREDENTIAL; update tableName=FED_USER_CREDENTIAL		\N	3.5.4	\N	\N	3820445829
8.0.0-credential-cleanup-fixed	keycloak	META-INF/jpa-changelog-8.0.0.xml	2022-02-02 16:47:26.945819	75	EXECUTED	7:b48da8c11a3d83ddd6b7d0c8c2219345	dropDefaultValue columnName=COUNTER, tableName=CREDENTIAL; dropDefaultValue columnName=DIGITS, tableName=CREDENTIAL; dropDefaultValue columnName=PERIOD, tableName=CREDENTIAL; dropDefaultValue columnName=ALGORITHM, tableName=CREDENTIAL; dropColumn ...		\N	3.5.4	\N	\N	3820445829
8.0.0-resource-tag-support	keycloak	META-INF/jpa-changelog-8.0.0.xml	2022-02-02 16:47:26.950255	76	EXECUTED	7:a73379915c23bfad3e8f5c6d5c0aa4bd	addColumn tableName=MIGRATION_MODEL; createIndex indexName=IDX_UPDATE_TIME, tableName=MIGRATION_MODEL		\N	3.5.4	\N	\N	3820445829
9.0.0-always-display-client	keycloak	META-INF/jpa-changelog-9.0.0.xml	2022-02-02 16:47:26.955505	77	EXECUTED	7:39e0073779aba192646291aa2332493d	addColumn tableName=CLIENT		\N	3.5.4	\N	\N	3820445829
9.0.0-drop-constraints-for-column-increase	keycloak	META-INF/jpa-changelog-9.0.0.xml	2022-02-02 16:47:26.957216	78	MARK_RAN	7:81f87368f00450799b4bf42ea0b3ec34	dropUniqueConstraint constraintName=UK_FRSR6T700S9V50BU18WS5PMT, tableName=RESOURCE_SERVER_PERM_TICKET; dropUniqueConstraint constraintName=UK_FRSR6T700S9V50BU18WS5HA6, tableName=RESOURCE_SERVER_RESOURCE; dropPrimaryKey constraintName=CONSTRAINT_O...		\N	3.5.4	\N	\N	3820445829
9.0.0-increase-column-size-federated-fk	keycloak	META-INF/jpa-changelog-9.0.0.xml	2022-02-02 16:47:26.966746	79	EXECUTED	7:20b37422abb9fb6571c618148f013a15	modifyDataType columnName=CLIENT_ID, tableName=FED_USER_CONSENT; modifyDataType columnName=CLIENT_REALM_CONSTRAINT, tableName=KEYCLOAK_ROLE; modifyDataType columnName=OWNER, tableName=RESOURCE_SERVER_POLICY; modifyDataType columnName=CLIENT_ID, ta...		\N	3.5.4	\N	\N	3820445829
9.0.0-recreate-constraints-after-column-increase	keycloak	META-INF/jpa-changelog-9.0.0.xml	2022-02-02 16:47:26.969643	80	MARK_RAN	7:1970bb6cfb5ee800736b95ad3fb3c78a	addNotNullConstraint columnName=CLIENT_ID, tableName=OFFLINE_CLIENT_SESSION; addNotNullConstraint columnName=OWNER, tableName=RESOURCE_SERVER_PERM_TICKET; addNotNullConstraint columnName=REQUESTER, tableName=RESOURCE_SERVER_PERM_TICKET; addNotNull...		\N	3.5.4	\N	\N	3820445829
9.0.1-add-index-to-client.client_id	keycloak	META-INF/jpa-changelog-9.0.1.xml	2022-02-02 16:47:26.975764	81	EXECUTED	7:45d9b25fc3b455d522d8dcc10a0f4c80	createIndex indexName=IDX_CLIENT_ID, tableName=CLIENT		\N	3.5.4	\N	\N	3820445829
9.0.1-KEYCLOAK-12579-drop-constraints	keycloak	META-INF/jpa-changelog-9.0.1.xml	2022-02-02 16:47:26.977227	82	MARK_RAN	7:890ae73712bc187a66c2813a724d037f	dropUniqueConstraint constraintName=SIBLING_NAMES, tableName=KEYCLOAK_GROUP		\N	3.5.4	\N	\N	3820445829
9.0.1-KEYCLOAK-12579-add-not-null-constraint	keycloak	META-INF/jpa-changelog-9.0.1.xml	2022-02-02 16:47:26.980058	83	EXECUTED	7:0a211980d27fafe3ff50d19a3a29b538	addNotNullConstraint columnName=PARENT_GROUP, tableName=KEYCLOAK_GROUP		\N	3.5.4	\N	\N	3820445829
9.0.1-KEYCLOAK-12579-recreate-constraints	keycloak	META-INF/jpa-changelog-9.0.1.xml	2022-02-02 16:47:26.981645	84	MARK_RAN	7:a161e2ae671a9020fff61e996a207377	addUniqueConstraint constraintName=SIBLING_NAMES, tableName=KEYCLOAK_GROUP		\N	3.5.4	\N	\N	3820445829
9.0.1-add-index-to-events	keycloak	META-INF/jpa-changelog-9.0.1.xml	2022-02-02 16:47:26.985465	85	EXECUTED	7:01c49302201bdf815b0a18d1f98a55dc	createIndex indexName=IDX_EVENT_TIME, tableName=EVENT_ENTITY		\N	3.5.4	\N	\N	3820445829
map-remove-ri	keycloak	META-INF/jpa-changelog-11.0.0.xml	2022-02-02 16:47:26.98869	86	EXECUTED	7:3dace6b144c11f53f1ad2c0361279b86	dropForeignKeyConstraint baseTableName=REALM, constraintName=FK_TRAF444KK6QRKMS7N56AIWQ5Y; dropForeignKeyConstraint baseTableName=KEYCLOAK_ROLE, constraintName=FK_KJHO5LE2C0RAL09FL8CM9WFW9		\N	3.5.4	\N	\N	3820445829
map-remove-ri	keycloak	META-INF/jpa-changelog-12.0.0.xml	2022-02-02 16:47:26.992854	87	EXECUTED	7:578d0b92077eaf2ab95ad0ec087aa903	dropForeignKeyConstraint baseTableName=REALM_DEFAULT_GROUPS, constraintName=FK_DEF_GROUPS_GROUP; dropForeignKeyConstraint baseTableName=REALM_DEFAULT_ROLES, constraintName=FK_H4WPD7W4HSOOLNI3H0SW7BTJE; dropForeignKeyConstraint baseTableName=CLIENT...		\N	3.5.4	\N	\N	3820445829
12.1.0-add-realm-localization-table	keycloak	META-INF/jpa-changelog-12.0.0.xml	2022-02-02 16:47:26.999694	88	EXECUTED	7:c95abe90d962c57a09ecaee57972835d	createTable tableName=REALM_LOCALIZATIONS; addPrimaryKey tableName=REALM_LOCALIZATIONS		\N	3.5.4	\N	\N	3820445829
\.


--
-- Data for Name: databasechangeloglock; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.databasechangeloglock (id, locked, lockgranted, lockedby) FROM stdin;
1	f	\N	\N
1000	f	\N	\N
1001	f	\N	\N
\.


--
-- Data for Name: default_client_scope; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.default_client_scope (realm_id, scope_id, default_scope) FROM stdin;
master	0cc71c8c-fb37-41f2-b4d8-13210d3cf8be	f
master	66deef47-2158-4d5b-a75f-0bf42f642e7b	t
master	94ef659c-4c4a-4a33-98e8-bfcf443e9268	t
master	96a960d2-c203-4ef0-a53c-c3edd01f2305	f
master	3f705379-3361-486d-b75a-f7b4e4be492c	f
master	b8a9cdd1-2f30-4e23-a721-78b01cfba1d7	t
master	619cf41a-5ff8-4a04-9f1e-50717e5f7ce8	t
master	42bfb506-bf0d-424e-8649-53a9a93d252d	f
grafana	0e98d5f9-d3f7-4b1d-9791-d442524fc2ab	f
grafana	74daf2cd-40d4-4304-87a8-92cdca808512	t
grafana	96d521d3-facc-4b5a-a8b4-a879bae6be07	t
grafana	a5bb3a5f-fd26-4be6-9557-26e20a03d33d	f
grafana	d6ffe9fc-a03c-4496-85dc-dbb5e7754587	f
grafana	d6077ed7-b265-4f82-9336-24614967bd5d	t
grafana	699671ab-e7c1-4fcf-beb8-ea54f1471fc1	t
grafana	c61f5b19-c17e-49a1-91b8-a0296411b928	f
\.


--
-- Data for Name: event_entity; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.event_entity (id, client_id, details_json, error, ip_address, realm_id, session_id, event_time, type, user_id) FROM stdin;
\.


--
-- Data for Name: fed_user_attribute; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.fed_user_attribute (id, name, user_id, realm_id, storage_provider_id, value) FROM stdin;
\.


--
-- Data for Name: fed_user_consent; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.fed_user_consent (id, client_id, user_id, realm_id, storage_provider_id, created_date, last_updated_date, client_storage_provider, external_client_id) FROM stdin;
\.


--
-- Data for Name: fed_user_consent_cl_scope; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.fed_user_consent_cl_scope (user_consent_id, scope_id) FROM stdin;
\.


--
-- Data for Name: fed_user_credential; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.fed_user_credential (id, salt, type, created_date, user_id, realm_id, storage_provider_id, user_label, secret_data, credential_data, priority) FROM stdin;
\.


--
-- Data for Name: fed_user_group_membership; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.fed_user_group_membership (group_id, user_id, realm_id, storage_provider_id) FROM stdin;
\.


--
-- Data for Name: fed_user_required_action; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.fed_user_required_action (required_action, user_id, realm_id, storage_provider_id) FROM stdin;
\.


--
-- Data for Name: fed_user_role_mapping; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.fed_user_role_mapping (role_id, user_id, realm_id, storage_provider_id) FROM stdin;
\.


--
-- Data for Name: federated_identity; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.federated_identity (identity_provider, realm_id, federated_user_id, federated_username, token, user_id) FROM stdin;
\.


--
-- Data for Name: federated_user; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.federated_user (id, storage_provider_id, realm_id) FROM stdin;
\.


--
-- Data for Name: group_attribute; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.group_attribute (id, name, value, group_id) FROM stdin;
\.


--
-- Data for Name: group_role_mapping; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.group_role_mapping (role_id, group_id) FROM stdin;
\.


--
-- Data for Name: identity_provider; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.identity_provider (internal_id, enabled, provider_alias, provider_id, store_token, authenticate_by_default, realm_id, add_token_role, trust_email, first_broker_login_flow_id, post_broker_login_flow_id, provider_display_name, link_only) FROM stdin;
\.


--
-- Data for Name: identity_provider_config; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.identity_provider_config (identity_provider_id, value, name) FROM stdin;
\.


--
-- Data for Name: identity_provider_mapper; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.identity_provider_mapper (id, name, idp_alias, idp_mapper_name, realm_id) FROM stdin;
\.


--
-- Data for Name: idp_mapper_config; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.idp_mapper_config (idp_mapper_id, value, name) FROM stdin;
\.


--
-- Data for Name: keycloak_group; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.keycloak_group (id, name, parent_group, realm_id) FROM stdin;
\.


--
-- Data for Name: keycloak_role; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.keycloak_role (id, client_realm_constraint, client_role, description, name, realm_id, client, realm) FROM stdin;
4a3204aa-320e-4584-b8ee-ea2989b3f330	master	f	${role_admin}	admin	master	\N	master
847ebc80-6849-4c47-9f9e-5bba0c0d754d	master	f	${role_create-realm}	create-realm	master	\N	master
103dc6a6-5e7a-4c27-b4f0-9dbb1fdcf214	3cd285ea-0f6e-43b6-ab5c-d021c33a551b	t	${role_create-client}	create-client	master	3cd285ea-0f6e-43b6-ab5c-d021c33a551b	\N
13c94e3b-b22f-4503-bc56-75e1bd2a927f	3cd285ea-0f6e-43b6-ab5c-d021c33a551b	t	${role_view-realm}	view-realm	master	3cd285ea-0f6e-43b6-ab5c-d021c33a551b	\N
4364a376-4ed0-4051-aeab-609f62420e5d	3cd285ea-0f6e-43b6-ab5c-d021c33a551b	t	${role_view-users}	view-users	master	3cd285ea-0f6e-43b6-ab5c-d021c33a551b	\N
f12af4b7-8828-47a5-abbc-dbb09b9d409e	3cd285ea-0f6e-43b6-ab5c-d021c33a551b	t	${role_view-clients}	view-clients	master	3cd285ea-0f6e-43b6-ab5c-d021c33a551b	\N
2606a5b9-699b-488a-a819-d6f368e66697	3cd285ea-0f6e-43b6-ab5c-d021c33a551b	t	${role_view-events}	view-events	master	3cd285ea-0f6e-43b6-ab5c-d021c33a551b	\N
2cf34980-2606-4faf-bc40-b9a47c69ef1c	3cd285ea-0f6e-43b6-ab5c-d021c33a551b	t	${role_view-identity-providers}	view-identity-providers	master	3cd285ea-0f6e-43b6-ab5c-d021c33a551b	\N
13e61c6b-aff6-4ef8-ab56-ad4abefcb101	3cd285ea-0f6e-43b6-ab5c-d021c33a551b	t	${role_view-authorization}	view-authorization	master	3cd285ea-0f6e-43b6-ab5c-d021c33a551b	\N
632bad74-a33f-4fd5-9393-ec0a07898b1a	3cd285ea-0f6e-43b6-ab5c-d021c33a551b	t	${role_manage-realm}	manage-realm	master	3cd285ea-0f6e-43b6-ab5c-d021c33a551b	\N
4607a008-f45c-45f5-b506-6de020b7e366	3cd285ea-0f6e-43b6-ab5c-d021c33a551b	t	${role_manage-users}	manage-users	master	3cd285ea-0f6e-43b6-ab5c-d021c33a551b	\N
edd471cc-81d5-43e4-bb43-41fe88ff537d	3cd285ea-0f6e-43b6-ab5c-d021c33a551b	t	${role_manage-clients}	manage-clients	master	3cd285ea-0f6e-43b6-ab5c-d021c33a551b	\N
4c2b4e2a-e792-4ffd-969d-e33ecdf7158f	3cd285ea-0f6e-43b6-ab5c-d021c33a551b	t	${role_manage-events}	manage-events	master	3cd285ea-0f6e-43b6-ab5c-d021c33a551b	\N
38282bc7-ea21-46db-a36e-ca621d3275b4	3cd285ea-0f6e-43b6-ab5c-d021c33a551b	t	${role_manage-identity-providers}	manage-identity-providers	master	3cd285ea-0f6e-43b6-ab5c-d021c33a551b	\N
12111f4a-16ee-4ee7-8576-7956b9440dc5	3cd285ea-0f6e-43b6-ab5c-d021c33a551b	t	${role_manage-authorization}	manage-authorization	master	3cd285ea-0f6e-43b6-ab5c-d021c33a551b	\N
f417ae21-5fb4-40fb-bda8-54c61ce7461d	3cd285ea-0f6e-43b6-ab5c-d021c33a551b	t	${role_query-users}	query-users	master	3cd285ea-0f6e-43b6-ab5c-d021c33a551b	\N
7adeaf33-05d3-4a81-a7bf-f99c721b5d9c	3cd285ea-0f6e-43b6-ab5c-d021c33a551b	t	${role_query-clients}	query-clients	master	3cd285ea-0f6e-43b6-ab5c-d021c33a551b	\N
60870d03-d96a-4371-bdad-e3fac925a8df	3cd285ea-0f6e-43b6-ab5c-d021c33a551b	t	${role_query-realms}	query-realms	master	3cd285ea-0f6e-43b6-ab5c-d021c33a551b	\N
94363dbd-a6b8-4678-8231-50208c32c22c	3cd285ea-0f6e-43b6-ab5c-d021c33a551b	t	${role_query-groups}	query-groups	master	3cd285ea-0f6e-43b6-ab5c-d021c33a551b	\N
86a4b6a9-93db-4177-a72f-95fd937a2c8d	eed689c6-49da-4d91-98eb-cd495bcc07a3	t	${role_view-profile}	view-profile	master	eed689c6-49da-4d91-98eb-cd495bcc07a3	\N
619ba870-921e-4f28-b26c-89b11f39dddf	eed689c6-49da-4d91-98eb-cd495bcc07a3	t	${role_manage-account}	manage-account	master	eed689c6-49da-4d91-98eb-cd495bcc07a3	\N
a42d235d-2864-4a99-9592-211d89d0407d	eed689c6-49da-4d91-98eb-cd495bcc07a3	t	${role_manage-account-links}	manage-account-links	master	eed689c6-49da-4d91-98eb-cd495bcc07a3	\N
44798fae-3813-41e6-9352-6fb2d28a15a6	eed689c6-49da-4d91-98eb-cd495bcc07a3	t	${role_view-applications}	view-applications	master	eed689c6-49da-4d91-98eb-cd495bcc07a3	\N
a1a08dbc-4553-4be7-85f5-88c417bdcd45	eed689c6-49da-4d91-98eb-cd495bcc07a3	t	${role_view-consent}	view-consent	master	eed689c6-49da-4d91-98eb-cd495bcc07a3	\N
828c3ba8-a13d-49f5-8975-8eb00afbf7de	eed689c6-49da-4d91-98eb-cd495bcc07a3	t	${role_manage-consent}	manage-consent	master	eed689c6-49da-4d91-98eb-cd495bcc07a3	\N
f537ddeb-0973-445c-8f32-3beed99461ba	eed689c6-49da-4d91-98eb-cd495bcc07a3	t	${role_delete-account}	delete-account	master	eed689c6-49da-4d91-98eb-cd495bcc07a3	\N
102d3759-c50d-4325-932d-c7a02fc17cb8	1e30397c-eac2-41fb-87bc-d90484992e65	t	${role_read-token}	read-token	master	1e30397c-eac2-41fb-87bc-d90484992e65	\N
b44e0fe0-0fb7-4e12-a6f0-b352431a0f57	3cd285ea-0f6e-43b6-ab5c-d021c33a551b	t	${role_impersonation}	impersonation	master	3cd285ea-0f6e-43b6-ab5c-d021c33a551b	\N
16d5987b-dcbb-4650-8f52-3469f3974846	master	f	${role_offline-access}	offline_access	master	\N	master
c014bfd1-a210-4e7a-8a26-35d1f5e8f1ed	master	f	${role_uma_authorization}	uma_authorization	master	\N	master
95dfed9c-47fe-489b-aa28-52f0d7aa7c49	ef7f6eac-9fff-44aa-a86c-5125d52acc82	t	${role_create-client}	create-client	master	ef7f6eac-9fff-44aa-a86c-5125d52acc82	\N
07e1586d-a943-46d9-9c3d-1f3544c8c27f	ef7f6eac-9fff-44aa-a86c-5125d52acc82	t	${role_view-realm}	view-realm	master	ef7f6eac-9fff-44aa-a86c-5125d52acc82	\N
293d0c06-6dce-4303-9cd3-dfdd6d1275b8	ef7f6eac-9fff-44aa-a86c-5125d52acc82	t	${role_view-users}	view-users	master	ef7f6eac-9fff-44aa-a86c-5125d52acc82	\N
cfdeeb7b-c70e-496b-9605-70377168a6cb	ef7f6eac-9fff-44aa-a86c-5125d52acc82	t	${role_view-clients}	view-clients	master	ef7f6eac-9fff-44aa-a86c-5125d52acc82	\N
74252705-a339-4513-97ca-d5617977d5ff	ef7f6eac-9fff-44aa-a86c-5125d52acc82	t	${role_view-events}	view-events	master	ef7f6eac-9fff-44aa-a86c-5125d52acc82	\N
77c3f67e-21d7-4c18-9971-4baf4c20eeaa	ef7f6eac-9fff-44aa-a86c-5125d52acc82	t	${role_view-identity-providers}	view-identity-providers	master	ef7f6eac-9fff-44aa-a86c-5125d52acc82	\N
5de01bf1-bfac-4ea2-8fb1-ed95594fe1da	ef7f6eac-9fff-44aa-a86c-5125d52acc82	t	${role_view-authorization}	view-authorization	master	ef7f6eac-9fff-44aa-a86c-5125d52acc82	\N
a72adc0b-5220-48e4-a66a-9e15dca5f574	ef7f6eac-9fff-44aa-a86c-5125d52acc82	t	${role_manage-realm}	manage-realm	master	ef7f6eac-9fff-44aa-a86c-5125d52acc82	\N
f29b8efa-3c08-410a-a5c0-15b52253d2e2	ef7f6eac-9fff-44aa-a86c-5125d52acc82	t	${role_manage-users}	manage-users	master	ef7f6eac-9fff-44aa-a86c-5125d52acc82	\N
dd3ecc72-aaee-43d5-8f7e-f6dcdfb5a608	ef7f6eac-9fff-44aa-a86c-5125d52acc82	t	${role_manage-clients}	manage-clients	master	ef7f6eac-9fff-44aa-a86c-5125d52acc82	\N
9d5a8bab-e112-4e1c-8196-604f3d0143ea	ef7f6eac-9fff-44aa-a86c-5125d52acc82	t	${role_manage-events}	manage-events	master	ef7f6eac-9fff-44aa-a86c-5125d52acc82	\N
ffff4251-e0a4-4f9c-8bf6-5461b2f52766	ef7f6eac-9fff-44aa-a86c-5125d52acc82	t	${role_manage-identity-providers}	manage-identity-providers	master	ef7f6eac-9fff-44aa-a86c-5125d52acc82	\N
5fafdde9-71f7-4f67-9c1d-f3f4bc7f5128	ef7f6eac-9fff-44aa-a86c-5125d52acc82	t	${role_manage-authorization}	manage-authorization	master	ef7f6eac-9fff-44aa-a86c-5125d52acc82	\N
6cfc2ac6-bdd7-4b90-ac16-27a75f2eb00a	ef7f6eac-9fff-44aa-a86c-5125d52acc82	t	${role_query-users}	query-users	master	ef7f6eac-9fff-44aa-a86c-5125d52acc82	\N
c3ded8eb-c970-4e43-bea9-5e07795d20ef	ef7f6eac-9fff-44aa-a86c-5125d52acc82	t	${role_query-clients}	query-clients	master	ef7f6eac-9fff-44aa-a86c-5125d52acc82	\N
811c2a39-6614-46fb-acf5-889d52248171	ef7f6eac-9fff-44aa-a86c-5125d52acc82	t	${role_query-realms}	query-realms	master	ef7f6eac-9fff-44aa-a86c-5125d52acc82	\N
2a90f228-2ca4-413f-bc4b-7939af8abcbf	ef7f6eac-9fff-44aa-a86c-5125d52acc82	t	${role_query-groups}	query-groups	master	ef7f6eac-9fff-44aa-a86c-5125d52acc82	\N
85afffb5-2069-4873-b6c8-08159c1e4bdd	a8698f4f-5fa1-4baa-be05-87d03052af49	t	${role_realm-admin}	realm-admin	grafana	a8698f4f-5fa1-4baa-be05-87d03052af49	\N
d0e4028d-a604-427a-9262-a1a9513dafc8	a8698f4f-5fa1-4baa-be05-87d03052af49	t	${role_create-client}	create-client	grafana	a8698f4f-5fa1-4baa-be05-87d03052af49	\N
2b8b60c5-d388-4925-b735-858df38dae6e	a8698f4f-5fa1-4baa-be05-87d03052af49	t	${role_view-realm}	view-realm	grafana	a8698f4f-5fa1-4baa-be05-87d03052af49	\N
e9c997c8-ad6b-4a99-81e1-c248e94fbeac	a8698f4f-5fa1-4baa-be05-87d03052af49	t	${role_view-users}	view-users	grafana	a8698f4f-5fa1-4baa-be05-87d03052af49	\N
8c4449b9-5add-40ba-a19f-cf5d80425e68	a8698f4f-5fa1-4baa-be05-87d03052af49	t	${role_view-clients}	view-clients	grafana	a8698f4f-5fa1-4baa-be05-87d03052af49	\N
a5f31b90-986b-46d5-a385-a639b4e19e37	a8698f4f-5fa1-4baa-be05-87d03052af49	t	${role_view-events}	view-events	grafana	a8698f4f-5fa1-4baa-be05-87d03052af49	\N
99bd546f-a5ed-47f8-862c-9a5e8345bf3b	a8698f4f-5fa1-4baa-be05-87d03052af49	t	${role_view-identity-providers}	view-identity-providers	grafana	a8698f4f-5fa1-4baa-be05-87d03052af49	\N
9096d8df-9d5b-4fb5-b93e-49acc6df0be5	a8698f4f-5fa1-4baa-be05-87d03052af49	t	${role_view-authorization}	view-authorization	grafana	a8698f4f-5fa1-4baa-be05-87d03052af49	\N
03230264-ed7a-46b2-939d-53ebe9a59812	a8698f4f-5fa1-4baa-be05-87d03052af49	t	${role_manage-realm}	manage-realm	grafana	a8698f4f-5fa1-4baa-be05-87d03052af49	\N
2240d1de-5ac4-44ac-91be-cee70e1dd22b	a8698f4f-5fa1-4baa-be05-87d03052af49	t	${role_manage-users}	manage-users	grafana	a8698f4f-5fa1-4baa-be05-87d03052af49	\N
6d2fd708-445b-44a8-b950-f1350a15dd14	a8698f4f-5fa1-4baa-be05-87d03052af49	t	${role_manage-clients}	manage-clients	grafana	a8698f4f-5fa1-4baa-be05-87d03052af49	\N
82266aa3-67ea-485a-a078-4671eb141853	a8698f4f-5fa1-4baa-be05-87d03052af49	t	${role_manage-events}	manage-events	grafana	a8698f4f-5fa1-4baa-be05-87d03052af49	\N
d6dad388-8c69-4bba-940e-371afc98042e	a8698f4f-5fa1-4baa-be05-87d03052af49	t	${role_manage-identity-providers}	manage-identity-providers	grafana	a8698f4f-5fa1-4baa-be05-87d03052af49	\N
5d7868e1-0c4a-46cc-8bac-bd19c0ea1bde	a8698f4f-5fa1-4baa-be05-87d03052af49	t	${role_manage-authorization}	manage-authorization	grafana	a8698f4f-5fa1-4baa-be05-87d03052af49	\N
85e6229e-e246-4e9a-8b39-7bae49754f7d	a8698f4f-5fa1-4baa-be05-87d03052af49	t	${role_query-users}	query-users	grafana	a8698f4f-5fa1-4baa-be05-87d03052af49	\N
bc618c28-98d1-477d-b4fc-c5ec7cd7f271	a8698f4f-5fa1-4baa-be05-87d03052af49	t	${role_query-clients}	query-clients	grafana	a8698f4f-5fa1-4baa-be05-87d03052af49	\N
5059b239-0dce-4bb2-9c55-a6afc8dcbe3b	a8698f4f-5fa1-4baa-be05-87d03052af49	t	${role_query-realms}	query-realms	grafana	a8698f4f-5fa1-4baa-be05-87d03052af49	\N
ac28461f-3416-4af4-be65-abc739dbeee5	a8698f4f-5fa1-4baa-be05-87d03052af49	t	${role_query-groups}	query-groups	grafana	a8698f4f-5fa1-4baa-be05-87d03052af49	\N
f1311ecb-6a6a-49d6-bb16-5132daf93a64	a5a8fed6-0bca-4646-9946-2fe84175353b	t	${role_view-profile}	view-profile	grafana	a5a8fed6-0bca-4646-9946-2fe84175353b	\N
18a7066b-fe71-410e-9581-69f78347ec29	a5a8fed6-0bca-4646-9946-2fe84175353b	t	${role_manage-account}	manage-account	grafana	a5a8fed6-0bca-4646-9946-2fe84175353b	\N
68fdbd76-8688-47a6-b68d-3298a5401f05	a5a8fed6-0bca-4646-9946-2fe84175353b	t	${role_manage-account-links}	manage-account-links	grafana	a5a8fed6-0bca-4646-9946-2fe84175353b	\N
cb37c15a-5330-4e30-9421-e0b962a266de	a5a8fed6-0bca-4646-9946-2fe84175353b	t	${role_view-applications}	view-applications	grafana	a5a8fed6-0bca-4646-9946-2fe84175353b	\N
daaedcc6-e7a6-488e-921e-7022aa808da7	a5a8fed6-0bca-4646-9946-2fe84175353b	t	${role_view-consent}	view-consent	grafana	a5a8fed6-0bca-4646-9946-2fe84175353b	\N
c7e799a5-1250-4bc8-b7c6-ffdc58361477	a5a8fed6-0bca-4646-9946-2fe84175353b	t	${role_manage-consent}	manage-consent	grafana	a5a8fed6-0bca-4646-9946-2fe84175353b	\N
744bfdff-0e88-438a-b852-282a1b2aad3e	a5a8fed6-0bca-4646-9946-2fe84175353b	t	${role_delete-account}	delete-account	grafana	a5a8fed6-0bca-4646-9946-2fe84175353b	\N
b8a4faaf-86d9-43eb-bb18-0eaa654b35a7	ef7f6eac-9fff-44aa-a86c-5125d52acc82	t	${role_impersonation}	impersonation	master	ef7f6eac-9fff-44aa-a86c-5125d52acc82	\N
5e2301d7-2a9e-4f2d-a940-9bd442b15d8c	a8698f4f-5fa1-4baa-be05-87d03052af49	t	${role_impersonation}	impersonation	grafana	a8698f4f-5fa1-4baa-be05-87d03052af49	\N
77ba7b40-e312-40d7-9da0-de41f0ed3b8c	77ff47f8-f578-477d-8c06-e70a846332f5	t	${role_read-token}	read-token	grafana	77ff47f8-f578-477d-8c06-e70a846332f5	\N
c49bddc6-ec92-4caa-bc04-57ba80a92eb9	grafana	f	${role_offline-access}	offline_access	grafana	\N	grafana
0f3d47bb-002a-4cd0-a502-725f224308a7	grafana	f	${role_uma_authorization}	uma_authorization	grafana	\N	grafana
60f1b1ea-9059-41ea-acef-573643b24709	grafana	f	Grafana Organization Administrator	admin	grafana	\N	grafana
c029a218-4519-4537-ae12-d8f3c27a0003	grafana	f	Grafana Server Admin	serveradmin	grafana	\N	grafana
c9a776f9-2740-435f-a725-4dbcc17a6c91	grafana	f	Grafana Viewer	viewer	grafana	\N	grafana
c4c74006-c346-48cf-8cf1-1617e3e1cde1	grafana	f	Grafana Editor	editor	grafana	\N	grafana
\.


--
-- Data for Name: migration_model; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.migration_model (id, version, update_time) FROM stdin;
g5slr	12.0.1	1643820448
\.


--
-- Data for Name: offline_client_session; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.offline_client_session (user_session_id, client_id, offline_flag, "timestamp", data, client_storage_provider, external_client_id) FROM stdin;
\.


--
-- Data for Name: offline_user_session; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.offline_user_session (user_session_id, user_id, realm_id, created_on, offline_flag, data, last_session_refresh) FROM stdin;
\.


--
-- Data for Name: policy_config; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.policy_config (policy_id, name, value) FROM stdin;
\.


--
-- Data for Name: protocol_mapper; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.protocol_mapper (id, name, protocol, protocol_mapper_name, client_id, client_scope_id) FROM stdin;
e4931993-ceb0-4048-8a37-ca4f438099f3	audience resolve	openid-connect	oidc-audience-resolve-mapper	11c67f5b-dde7-4680-b05b-c9c59d78bda4	\N
c1c53a76-92ee-42b8-8420-92a815267f71	locale	openid-connect	oidc-usermodel-attribute-mapper	2f521d09-7304-4b5e-a94b-7cc7300b8b50	\N
ddc7c8be-0753-417f-9d0e-ea22008f23f9	full name	openid-connect	oidc-full-name-mapper	\N	66deef47-2158-4d5b-a75f-0bf42f642e7b
fc77e0b8-b586-40dc-bc3d-7aa04a9c0f19	family name	openid-connect	oidc-usermodel-property-mapper	\N	66deef47-2158-4d5b-a75f-0bf42f642e7b
563b93e7-e66d-454f-9f34-4538cab6f260	given name	openid-connect	oidc-usermodel-property-mapper	\N	66deef47-2158-4d5b-a75f-0bf42f642e7b
30fa9092-eb2a-4a55-8d73-82e6e23334ec	middle name	openid-connect	oidc-usermodel-attribute-mapper	\N	66deef47-2158-4d5b-a75f-0bf42f642e7b
6aff4774-b4cf-4775-b4e5-0b20c549d181	nickname	openid-connect	oidc-usermodel-attribute-mapper	\N	66deef47-2158-4d5b-a75f-0bf42f642e7b
5a603582-2511-483b-8e05-be891c7642b1	username	openid-connect	oidc-usermodel-property-mapper	\N	66deef47-2158-4d5b-a75f-0bf42f642e7b
9e111324-2508-4a4b-841a-19883a331f66	profile	openid-connect	oidc-usermodel-attribute-mapper	\N	66deef47-2158-4d5b-a75f-0bf42f642e7b
5906ef3c-7b55-4b10-9ba1-0f3a25f3b005	picture	openid-connect	oidc-usermodel-attribute-mapper	\N	66deef47-2158-4d5b-a75f-0bf42f642e7b
412ba9b5-f535-4263-9600-b23c2f682fc9	website	openid-connect	oidc-usermodel-attribute-mapper	\N	66deef47-2158-4d5b-a75f-0bf42f642e7b
3741c094-0c4f-42fb-a178-89ceb85adeda	gender	openid-connect	oidc-usermodel-attribute-mapper	\N	66deef47-2158-4d5b-a75f-0bf42f642e7b
ae6e2dbc-b310-4443-acd2-894d4e9dcb79	birthdate	openid-connect	oidc-usermodel-attribute-mapper	\N	66deef47-2158-4d5b-a75f-0bf42f642e7b
7f9b6774-17f5-417a-8fad-576fc862920c	zoneinfo	openid-connect	oidc-usermodel-attribute-mapper	\N	66deef47-2158-4d5b-a75f-0bf42f642e7b
7257c710-d01b-4c50-bb4f-060cfc8fe4b3	locale	openid-connect	oidc-usermodel-attribute-mapper	\N	66deef47-2158-4d5b-a75f-0bf42f642e7b
1ab8f9c8-42cc-4604-8c04-43f8243acc9b	updated at	openid-connect	oidc-usermodel-attribute-mapper	\N	66deef47-2158-4d5b-a75f-0bf42f642e7b
b47f8f1c-0242-40c3-973a-d58a25022d6e	email	openid-connect	oidc-usermodel-property-mapper	\N	94ef659c-4c4a-4a33-98e8-bfcf443e9268
a5fcd319-279d-4995-8896-4bf810343ad2	email verified	openid-connect	oidc-usermodel-property-mapper	\N	94ef659c-4c4a-4a33-98e8-bfcf443e9268
4d697f62-b924-4b0c-8202-0a82ee08684c	address	openid-connect	oidc-address-mapper	\N	96a960d2-c203-4ef0-a53c-c3edd01f2305
d1eaf34e-6818-419c-b3c1-8f1b3627ca17	phone number	openid-connect	oidc-usermodel-attribute-mapper	\N	3f705379-3361-486d-b75a-f7b4e4be492c
ee0ec8fa-c020-4cb9-991e-30180fe0c5dc	phone number verified	openid-connect	oidc-usermodel-attribute-mapper	\N	3f705379-3361-486d-b75a-f7b4e4be492c
bc41b27d-2e1b-48af-8184-e88e03f950e2	realm roles	openid-connect	oidc-usermodel-realm-role-mapper	\N	b8a9cdd1-2f30-4e23-a721-78b01cfba1d7
967cee35-09fd-400f-a634-db3fdbab2420	client roles	openid-connect	oidc-usermodel-client-role-mapper	\N	b8a9cdd1-2f30-4e23-a721-78b01cfba1d7
543542f4-71b1-4fef-8832-bb14b553ad9a	audience resolve	openid-connect	oidc-audience-resolve-mapper	\N	b8a9cdd1-2f30-4e23-a721-78b01cfba1d7
bf72f65b-9d9c-4c88-9cb9-478edbb721db	allowed web origins	openid-connect	oidc-allowed-origins-mapper	\N	619cf41a-5ff8-4a04-9f1e-50717e5f7ce8
98402b93-9012-4e47-b008-99ffaf93043e	upn	openid-connect	oidc-usermodel-property-mapper	\N	42bfb506-bf0d-424e-8649-53a9a93d252d
39d571e6-0b8b-4b6d-aa2d-9cff126decd0	groups	openid-connect	oidc-usermodel-realm-role-mapper	\N	42bfb506-bf0d-424e-8649-53a9a93d252d
7be7c4e2-7281-4226-acec-77f77b3072dc	audience resolve	openid-connect	oidc-audience-resolve-mapper	230081b5-9161-45c3-9e08-9eda5412f7f7	\N
c5adae03-51f5-4acb-baeb-c0241a16757e	full name	openid-connect	oidc-full-name-mapper	\N	74daf2cd-40d4-4304-87a8-92cdca808512
6d019964-a5e5-4737-a8bf-90c34ce33c0f	family name	openid-connect	oidc-usermodel-property-mapper	\N	74daf2cd-40d4-4304-87a8-92cdca808512
e9cb431c-e1f1-4ce9-941e-a8a88bfce413	given name	openid-connect	oidc-usermodel-property-mapper	\N	74daf2cd-40d4-4304-87a8-92cdca808512
4cec49ad-50de-4fed-bf61-3928d88b9cfc	middle name	openid-connect	oidc-usermodel-attribute-mapper	\N	74daf2cd-40d4-4304-87a8-92cdca808512
21dd6189-62cb-4039-9590-9096ff6d14b2	nickname	openid-connect	oidc-usermodel-attribute-mapper	\N	74daf2cd-40d4-4304-87a8-92cdca808512
bcb6bed8-ebfc-450b-b4a6-17f5bdfaa37c	username	openid-connect	oidc-usermodel-property-mapper	\N	74daf2cd-40d4-4304-87a8-92cdca808512
c21b39cc-c761-4cf4-a4a4-6de3ff05476d	profile	openid-connect	oidc-usermodel-attribute-mapper	\N	74daf2cd-40d4-4304-87a8-92cdca808512
aeec7bd1-953e-4ba0-b146-c87f1e20f73f	picture	openid-connect	oidc-usermodel-attribute-mapper	\N	74daf2cd-40d4-4304-87a8-92cdca808512
02f83a6b-7a50-4541-9b12-968a23e2cf78	website	openid-connect	oidc-usermodel-attribute-mapper	\N	74daf2cd-40d4-4304-87a8-92cdca808512
013a3f59-6a7f-42e4-9fce-4fc420a1b3ea	gender	openid-connect	oidc-usermodel-attribute-mapper	\N	74daf2cd-40d4-4304-87a8-92cdca808512
04b7ca11-80bd-44a1-87c3-835e7fb9e9f5	birthdate	openid-connect	oidc-usermodel-attribute-mapper	\N	74daf2cd-40d4-4304-87a8-92cdca808512
49703eaa-a556-431d-b828-c64d8c791d00	zoneinfo	openid-connect	oidc-usermodel-attribute-mapper	\N	74daf2cd-40d4-4304-87a8-92cdca808512
2b9ace9b-a654-4178-bb28-c8062569453c	locale	openid-connect	oidc-usermodel-attribute-mapper	\N	74daf2cd-40d4-4304-87a8-92cdca808512
60babdab-a8a4-41a4-98b0-08bd40182cdf	updated at	openid-connect	oidc-usermodel-attribute-mapper	\N	74daf2cd-40d4-4304-87a8-92cdca808512
75ae2f8d-a382-47e7-978a-f51bf12b80ae	email	openid-connect	oidc-usermodel-property-mapper	\N	96d521d3-facc-4b5a-a8b4-a879bae6be07
b75ba788-217a-47ad-bc81-2e8f4dcce913	email verified	openid-connect	oidc-usermodel-property-mapper	\N	96d521d3-facc-4b5a-a8b4-a879bae6be07
c83418a1-6b68-4fd7-8b97-d22f0e2e0ad0	address	openid-connect	oidc-address-mapper	\N	a5bb3a5f-fd26-4be6-9557-26e20a03d33d
13c34a80-7711-4a0d-97b0-b29a501294fa	phone number	openid-connect	oidc-usermodel-attribute-mapper	\N	d6ffe9fc-a03c-4496-85dc-dbb5e7754587
b4854867-3bfb-409b-92a8-6ec37db17f99	phone number verified	openid-connect	oidc-usermodel-attribute-mapper	\N	d6ffe9fc-a03c-4496-85dc-dbb5e7754587
1fc8999a-04d9-421b-8557-e417a3750358	realm roles	openid-connect	oidc-usermodel-realm-role-mapper	\N	d6077ed7-b265-4f82-9336-24614967bd5d
384e97dd-36ad-4b0e-af63-d0cb3a2153d4	allowed web origins	openid-connect	oidc-allowed-origins-mapper	\N	699671ab-e7c1-4fcf-beb8-ea54f1471fc1
f03cac68-3f0e-4068-9adf-ee64567689a7	upn	openid-connect	oidc-usermodel-property-mapper	\N	c61f5b19-c17e-49a1-91b8-a0296411b928
04183ee1-b558-4f63-839f-922d30b34a9e	groups	openid-connect	oidc-usermodel-realm-role-mapper	\N	c61f5b19-c17e-49a1-91b8-a0296411b928
df78645e-c32b-4160-b79f-42e622d71982	locale	openid-connect	oidc-usermodel-attribute-mapper	805aebc8-9d01-42b6-bcce-6ce48ca63ef0	\N
0108b99f-2f31-4e73-9597-cb29e0e8c486	username	openid-connect	oidc-usermodel-property-mapper	\N	f619a55a-d565-4cc0-8bf4-4dbaab5382fe
70b0a264-a7c3-43ff-b24f-14ca4f5f118e	login	openid-connect	oidc-usermodel-property-mapper	\N	0a7c7dde-23d7-4a93-bdee-4a8963aee9a4
2f8ee9af-b6dd-4790-9e7b-cce83a603566	name	openid-connect	oidc-full-name-mapper	\N	d4723cd4-f717-44b7-a9b0-6c32c5ecd23f
\.


--
-- Data for Name: protocol_mapper_config; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.protocol_mapper_config (protocol_mapper_id, value, name) FROM stdin;
c1c53a76-92ee-42b8-8420-92a815267f71	true	userinfo.token.claim
c1c53a76-92ee-42b8-8420-92a815267f71	locale	user.attribute
c1c53a76-92ee-42b8-8420-92a815267f71	true	id.token.claim
c1c53a76-92ee-42b8-8420-92a815267f71	true	access.token.claim
c1c53a76-92ee-42b8-8420-92a815267f71	locale	claim.name
c1c53a76-92ee-42b8-8420-92a815267f71	String	jsonType.label
ddc7c8be-0753-417f-9d0e-ea22008f23f9	true	userinfo.token.claim
ddc7c8be-0753-417f-9d0e-ea22008f23f9	true	id.token.claim
ddc7c8be-0753-417f-9d0e-ea22008f23f9	true	access.token.claim
fc77e0b8-b586-40dc-bc3d-7aa04a9c0f19	true	userinfo.token.claim
fc77e0b8-b586-40dc-bc3d-7aa04a9c0f19	lastName	user.attribute
fc77e0b8-b586-40dc-bc3d-7aa04a9c0f19	true	id.token.claim
fc77e0b8-b586-40dc-bc3d-7aa04a9c0f19	true	access.token.claim
fc77e0b8-b586-40dc-bc3d-7aa04a9c0f19	family_name	claim.name
fc77e0b8-b586-40dc-bc3d-7aa04a9c0f19	String	jsonType.label
563b93e7-e66d-454f-9f34-4538cab6f260	true	userinfo.token.claim
563b93e7-e66d-454f-9f34-4538cab6f260	firstName	user.attribute
563b93e7-e66d-454f-9f34-4538cab6f260	true	id.token.claim
563b93e7-e66d-454f-9f34-4538cab6f260	true	access.token.claim
563b93e7-e66d-454f-9f34-4538cab6f260	given_name	claim.name
563b93e7-e66d-454f-9f34-4538cab6f260	String	jsonType.label
30fa9092-eb2a-4a55-8d73-82e6e23334ec	true	userinfo.token.claim
30fa9092-eb2a-4a55-8d73-82e6e23334ec	middleName	user.attribute
30fa9092-eb2a-4a55-8d73-82e6e23334ec	true	id.token.claim
30fa9092-eb2a-4a55-8d73-82e6e23334ec	true	access.token.claim
30fa9092-eb2a-4a55-8d73-82e6e23334ec	middle_name	claim.name
30fa9092-eb2a-4a55-8d73-82e6e23334ec	String	jsonType.label
6aff4774-b4cf-4775-b4e5-0b20c549d181	true	userinfo.token.claim
6aff4774-b4cf-4775-b4e5-0b20c549d181	nickname	user.attribute
6aff4774-b4cf-4775-b4e5-0b20c549d181	true	id.token.claim
6aff4774-b4cf-4775-b4e5-0b20c549d181	true	access.token.claim
6aff4774-b4cf-4775-b4e5-0b20c549d181	nickname	claim.name
6aff4774-b4cf-4775-b4e5-0b20c549d181	String	jsonType.label
5a603582-2511-483b-8e05-be891c7642b1	true	userinfo.token.claim
5a603582-2511-483b-8e05-be891c7642b1	username	user.attribute
5a603582-2511-483b-8e05-be891c7642b1	true	id.token.claim
5a603582-2511-483b-8e05-be891c7642b1	true	access.token.claim
5a603582-2511-483b-8e05-be891c7642b1	preferred_username	claim.name
5a603582-2511-483b-8e05-be891c7642b1	String	jsonType.label
9e111324-2508-4a4b-841a-19883a331f66	true	userinfo.token.claim
9e111324-2508-4a4b-841a-19883a331f66	profile	user.attribute
9e111324-2508-4a4b-841a-19883a331f66	true	id.token.claim
9e111324-2508-4a4b-841a-19883a331f66	true	access.token.claim
9e111324-2508-4a4b-841a-19883a331f66	profile	claim.name
9e111324-2508-4a4b-841a-19883a331f66	String	jsonType.label
5906ef3c-7b55-4b10-9ba1-0f3a25f3b005	true	userinfo.token.claim
5906ef3c-7b55-4b10-9ba1-0f3a25f3b005	picture	user.attribute
5906ef3c-7b55-4b10-9ba1-0f3a25f3b005	true	id.token.claim
5906ef3c-7b55-4b10-9ba1-0f3a25f3b005	true	access.token.claim
5906ef3c-7b55-4b10-9ba1-0f3a25f3b005	picture	claim.name
5906ef3c-7b55-4b10-9ba1-0f3a25f3b005	String	jsonType.label
412ba9b5-f535-4263-9600-b23c2f682fc9	true	userinfo.token.claim
412ba9b5-f535-4263-9600-b23c2f682fc9	website	user.attribute
412ba9b5-f535-4263-9600-b23c2f682fc9	true	id.token.claim
412ba9b5-f535-4263-9600-b23c2f682fc9	true	access.token.claim
412ba9b5-f535-4263-9600-b23c2f682fc9	website	claim.name
412ba9b5-f535-4263-9600-b23c2f682fc9	String	jsonType.label
3741c094-0c4f-42fb-a178-89ceb85adeda	true	userinfo.token.claim
3741c094-0c4f-42fb-a178-89ceb85adeda	gender	user.attribute
3741c094-0c4f-42fb-a178-89ceb85adeda	true	id.token.claim
3741c094-0c4f-42fb-a178-89ceb85adeda	true	access.token.claim
3741c094-0c4f-42fb-a178-89ceb85adeda	gender	claim.name
3741c094-0c4f-42fb-a178-89ceb85adeda	String	jsonType.label
ae6e2dbc-b310-4443-acd2-894d4e9dcb79	true	userinfo.token.claim
ae6e2dbc-b310-4443-acd2-894d4e9dcb79	birthdate	user.attribute
ae6e2dbc-b310-4443-acd2-894d4e9dcb79	true	id.token.claim
ae6e2dbc-b310-4443-acd2-894d4e9dcb79	true	access.token.claim
ae6e2dbc-b310-4443-acd2-894d4e9dcb79	birthdate	claim.name
ae6e2dbc-b310-4443-acd2-894d4e9dcb79	String	jsonType.label
7f9b6774-17f5-417a-8fad-576fc862920c	true	userinfo.token.claim
7f9b6774-17f5-417a-8fad-576fc862920c	zoneinfo	user.attribute
7f9b6774-17f5-417a-8fad-576fc862920c	true	id.token.claim
7f9b6774-17f5-417a-8fad-576fc862920c	true	access.token.claim
7f9b6774-17f5-417a-8fad-576fc862920c	zoneinfo	claim.name
7f9b6774-17f5-417a-8fad-576fc862920c	String	jsonType.label
7257c710-d01b-4c50-bb4f-060cfc8fe4b3	true	userinfo.token.claim
7257c710-d01b-4c50-bb4f-060cfc8fe4b3	locale	user.attribute
7257c710-d01b-4c50-bb4f-060cfc8fe4b3	true	id.token.claim
7257c710-d01b-4c50-bb4f-060cfc8fe4b3	true	access.token.claim
7257c710-d01b-4c50-bb4f-060cfc8fe4b3	locale	claim.name
7257c710-d01b-4c50-bb4f-060cfc8fe4b3	String	jsonType.label
1ab8f9c8-42cc-4604-8c04-43f8243acc9b	true	userinfo.token.claim
1ab8f9c8-42cc-4604-8c04-43f8243acc9b	updatedAt	user.attribute
1ab8f9c8-42cc-4604-8c04-43f8243acc9b	true	id.token.claim
1ab8f9c8-42cc-4604-8c04-43f8243acc9b	true	access.token.claim
1ab8f9c8-42cc-4604-8c04-43f8243acc9b	updated_at	claim.name
1ab8f9c8-42cc-4604-8c04-43f8243acc9b	String	jsonType.label
b47f8f1c-0242-40c3-973a-d58a25022d6e	true	userinfo.token.claim
b47f8f1c-0242-40c3-973a-d58a25022d6e	email	user.attribute
b47f8f1c-0242-40c3-973a-d58a25022d6e	true	id.token.claim
b47f8f1c-0242-40c3-973a-d58a25022d6e	true	access.token.claim
b47f8f1c-0242-40c3-973a-d58a25022d6e	email	claim.name
b47f8f1c-0242-40c3-973a-d58a25022d6e	String	jsonType.label
a5fcd319-279d-4995-8896-4bf810343ad2	true	userinfo.token.claim
a5fcd319-279d-4995-8896-4bf810343ad2	emailVerified	user.attribute
a5fcd319-279d-4995-8896-4bf810343ad2	true	id.token.claim
a5fcd319-279d-4995-8896-4bf810343ad2	true	access.token.claim
a5fcd319-279d-4995-8896-4bf810343ad2	email_verified	claim.name
a5fcd319-279d-4995-8896-4bf810343ad2	boolean	jsonType.label
4d697f62-b924-4b0c-8202-0a82ee08684c	formatted	user.attribute.formatted
4d697f62-b924-4b0c-8202-0a82ee08684c	country	user.attribute.country
4d697f62-b924-4b0c-8202-0a82ee08684c	postal_code	user.attribute.postal_code
4d697f62-b924-4b0c-8202-0a82ee08684c	true	userinfo.token.claim
4d697f62-b924-4b0c-8202-0a82ee08684c	street	user.attribute.street
4d697f62-b924-4b0c-8202-0a82ee08684c	true	id.token.claim
4d697f62-b924-4b0c-8202-0a82ee08684c	region	user.attribute.region
4d697f62-b924-4b0c-8202-0a82ee08684c	true	access.token.claim
4d697f62-b924-4b0c-8202-0a82ee08684c	locality	user.attribute.locality
d1eaf34e-6818-419c-b3c1-8f1b3627ca17	true	userinfo.token.claim
d1eaf34e-6818-419c-b3c1-8f1b3627ca17	phoneNumber	user.attribute
d1eaf34e-6818-419c-b3c1-8f1b3627ca17	true	id.token.claim
d1eaf34e-6818-419c-b3c1-8f1b3627ca17	true	access.token.claim
d1eaf34e-6818-419c-b3c1-8f1b3627ca17	phone_number	claim.name
d1eaf34e-6818-419c-b3c1-8f1b3627ca17	String	jsonType.label
ee0ec8fa-c020-4cb9-991e-30180fe0c5dc	true	userinfo.token.claim
ee0ec8fa-c020-4cb9-991e-30180fe0c5dc	phoneNumberVerified	user.attribute
ee0ec8fa-c020-4cb9-991e-30180fe0c5dc	true	id.token.claim
ee0ec8fa-c020-4cb9-991e-30180fe0c5dc	true	access.token.claim
ee0ec8fa-c020-4cb9-991e-30180fe0c5dc	phone_number_verified	claim.name
ee0ec8fa-c020-4cb9-991e-30180fe0c5dc	boolean	jsonType.label
bc41b27d-2e1b-48af-8184-e88e03f950e2	true	multivalued
bc41b27d-2e1b-48af-8184-e88e03f950e2	foo	user.attribute
bc41b27d-2e1b-48af-8184-e88e03f950e2	true	access.token.claim
bc41b27d-2e1b-48af-8184-e88e03f950e2	realm_access.roles	claim.name
bc41b27d-2e1b-48af-8184-e88e03f950e2	String	jsonType.label
967cee35-09fd-400f-a634-db3fdbab2420	true	multivalued
967cee35-09fd-400f-a634-db3fdbab2420	foo	user.attribute
967cee35-09fd-400f-a634-db3fdbab2420	true	access.token.claim
967cee35-09fd-400f-a634-db3fdbab2420	resource_access.${client_id}.roles	claim.name
967cee35-09fd-400f-a634-db3fdbab2420	String	jsonType.label
98402b93-9012-4e47-b008-99ffaf93043e	true	userinfo.token.claim
98402b93-9012-4e47-b008-99ffaf93043e	username	user.attribute
98402b93-9012-4e47-b008-99ffaf93043e	true	id.token.claim
98402b93-9012-4e47-b008-99ffaf93043e	true	access.token.claim
98402b93-9012-4e47-b008-99ffaf93043e	upn	claim.name
98402b93-9012-4e47-b008-99ffaf93043e	String	jsonType.label
39d571e6-0b8b-4b6d-aa2d-9cff126decd0	true	multivalued
39d571e6-0b8b-4b6d-aa2d-9cff126decd0	foo	user.attribute
39d571e6-0b8b-4b6d-aa2d-9cff126decd0	true	id.token.claim
39d571e6-0b8b-4b6d-aa2d-9cff126decd0	true	access.token.claim
39d571e6-0b8b-4b6d-aa2d-9cff126decd0	groups	claim.name
39d571e6-0b8b-4b6d-aa2d-9cff126decd0	String	jsonType.label
c5adae03-51f5-4acb-baeb-c0241a16757e	true	userinfo.token.claim
c5adae03-51f5-4acb-baeb-c0241a16757e	true	id.token.claim
c5adae03-51f5-4acb-baeb-c0241a16757e	true	access.token.claim
6d019964-a5e5-4737-a8bf-90c34ce33c0f	true	userinfo.token.claim
6d019964-a5e5-4737-a8bf-90c34ce33c0f	lastName	user.attribute
6d019964-a5e5-4737-a8bf-90c34ce33c0f	true	id.token.claim
6d019964-a5e5-4737-a8bf-90c34ce33c0f	true	access.token.claim
6d019964-a5e5-4737-a8bf-90c34ce33c0f	family_name	claim.name
6d019964-a5e5-4737-a8bf-90c34ce33c0f	String	jsonType.label
e9cb431c-e1f1-4ce9-941e-a8a88bfce413	true	userinfo.token.claim
e9cb431c-e1f1-4ce9-941e-a8a88bfce413	firstName	user.attribute
e9cb431c-e1f1-4ce9-941e-a8a88bfce413	true	id.token.claim
e9cb431c-e1f1-4ce9-941e-a8a88bfce413	true	access.token.claim
e9cb431c-e1f1-4ce9-941e-a8a88bfce413	given_name	claim.name
e9cb431c-e1f1-4ce9-941e-a8a88bfce413	String	jsonType.label
4cec49ad-50de-4fed-bf61-3928d88b9cfc	true	userinfo.token.claim
4cec49ad-50de-4fed-bf61-3928d88b9cfc	middleName	user.attribute
4cec49ad-50de-4fed-bf61-3928d88b9cfc	true	id.token.claim
4cec49ad-50de-4fed-bf61-3928d88b9cfc	true	access.token.claim
4cec49ad-50de-4fed-bf61-3928d88b9cfc	middle_name	claim.name
4cec49ad-50de-4fed-bf61-3928d88b9cfc	String	jsonType.label
21dd6189-62cb-4039-9590-9096ff6d14b2	true	userinfo.token.claim
21dd6189-62cb-4039-9590-9096ff6d14b2	nickname	user.attribute
21dd6189-62cb-4039-9590-9096ff6d14b2	true	id.token.claim
21dd6189-62cb-4039-9590-9096ff6d14b2	true	access.token.claim
21dd6189-62cb-4039-9590-9096ff6d14b2	nickname	claim.name
21dd6189-62cb-4039-9590-9096ff6d14b2	String	jsonType.label
bcb6bed8-ebfc-450b-b4a6-17f5bdfaa37c	true	userinfo.token.claim
bcb6bed8-ebfc-450b-b4a6-17f5bdfaa37c	username	user.attribute
bcb6bed8-ebfc-450b-b4a6-17f5bdfaa37c	true	id.token.claim
bcb6bed8-ebfc-450b-b4a6-17f5bdfaa37c	true	access.token.claim
bcb6bed8-ebfc-450b-b4a6-17f5bdfaa37c	preferred_username	claim.name
bcb6bed8-ebfc-450b-b4a6-17f5bdfaa37c	String	jsonType.label
c21b39cc-c761-4cf4-a4a4-6de3ff05476d	true	userinfo.token.claim
c21b39cc-c761-4cf4-a4a4-6de3ff05476d	profile	user.attribute
c21b39cc-c761-4cf4-a4a4-6de3ff05476d	true	id.token.claim
c21b39cc-c761-4cf4-a4a4-6de3ff05476d	true	access.token.claim
c21b39cc-c761-4cf4-a4a4-6de3ff05476d	profile	claim.name
c21b39cc-c761-4cf4-a4a4-6de3ff05476d	String	jsonType.label
aeec7bd1-953e-4ba0-b146-c87f1e20f73f	true	userinfo.token.claim
aeec7bd1-953e-4ba0-b146-c87f1e20f73f	picture	user.attribute
aeec7bd1-953e-4ba0-b146-c87f1e20f73f	true	id.token.claim
aeec7bd1-953e-4ba0-b146-c87f1e20f73f	true	access.token.claim
aeec7bd1-953e-4ba0-b146-c87f1e20f73f	picture	claim.name
aeec7bd1-953e-4ba0-b146-c87f1e20f73f	String	jsonType.label
02f83a6b-7a50-4541-9b12-968a23e2cf78	true	userinfo.token.claim
02f83a6b-7a50-4541-9b12-968a23e2cf78	website	user.attribute
02f83a6b-7a50-4541-9b12-968a23e2cf78	true	id.token.claim
02f83a6b-7a50-4541-9b12-968a23e2cf78	true	access.token.claim
02f83a6b-7a50-4541-9b12-968a23e2cf78	website	claim.name
02f83a6b-7a50-4541-9b12-968a23e2cf78	String	jsonType.label
013a3f59-6a7f-42e4-9fce-4fc420a1b3ea	true	userinfo.token.claim
013a3f59-6a7f-42e4-9fce-4fc420a1b3ea	gender	user.attribute
013a3f59-6a7f-42e4-9fce-4fc420a1b3ea	true	id.token.claim
013a3f59-6a7f-42e4-9fce-4fc420a1b3ea	true	access.token.claim
013a3f59-6a7f-42e4-9fce-4fc420a1b3ea	gender	claim.name
013a3f59-6a7f-42e4-9fce-4fc420a1b3ea	String	jsonType.label
04b7ca11-80bd-44a1-87c3-835e7fb9e9f5	true	userinfo.token.claim
04b7ca11-80bd-44a1-87c3-835e7fb9e9f5	birthdate	user.attribute
04b7ca11-80bd-44a1-87c3-835e7fb9e9f5	true	id.token.claim
04b7ca11-80bd-44a1-87c3-835e7fb9e9f5	true	access.token.claim
04b7ca11-80bd-44a1-87c3-835e7fb9e9f5	birthdate	claim.name
04b7ca11-80bd-44a1-87c3-835e7fb9e9f5	String	jsonType.label
49703eaa-a556-431d-b828-c64d8c791d00	true	userinfo.token.claim
49703eaa-a556-431d-b828-c64d8c791d00	zoneinfo	user.attribute
49703eaa-a556-431d-b828-c64d8c791d00	true	id.token.claim
49703eaa-a556-431d-b828-c64d8c791d00	true	access.token.claim
49703eaa-a556-431d-b828-c64d8c791d00	zoneinfo	claim.name
49703eaa-a556-431d-b828-c64d8c791d00	String	jsonType.label
2b9ace9b-a654-4178-bb28-c8062569453c	true	userinfo.token.claim
2b9ace9b-a654-4178-bb28-c8062569453c	locale	user.attribute
2b9ace9b-a654-4178-bb28-c8062569453c	true	id.token.claim
2b9ace9b-a654-4178-bb28-c8062569453c	true	access.token.claim
2b9ace9b-a654-4178-bb28-c8062569453c	locale	claim.name
2b9ace9b-a654-4178-bb28-c8062569453c	String	jsonType.label
60babdab-a8a4-41a4-98b0-08bd40182cdf	true	userinfo.token.claim
60babdab-a8a4-41a4-98b0-08bd40182cdf	updatedAt	user.attribute
60babdab-a8a4-41a4-98b0-08bd40182cdf	true	id.token.claim
60babdab-a8a4-41a4-98b0-08bd40182cdf	true	access.token.claim
60babdab-a8a4-41a4-98b0-08bd40182cdf	updated_at	claim.name
60babdab-a8a4-41a4-98b0-08bd40182cdf	String	jsonType.label
75ae2f8d-a382-47e7-978a-f51bf12b80ae	true	userinfo.token.claim
75ae2f8d-a382-47e7-978a-f51bf12b80ae	email	user.attribute
75ae2f8d-a382-47e7-978a-f51bf12b80ae	true	id.token.claim
75ae2f8d-a382-47e7-978a-f51bf12b80ae	true	access.token.claim
75ae2f8d-a382-47e7-978a-f51bf12b80ae	email	claim.name
75ae2f8d-a382-47e7-978a-f51bf12b80ae	String	jsonType.label
b75ba788-217a-47ad-bc81-2e8f4dcce913	true	userinfo.token.claim
b75ba788-217a-47ad-bc81-2e8f4dcce913	emailVerified	user.attribute
b75ba788-217a-47ad-bc81-2e8f4dcce913	true	id.token.claim
b75ba788-217a-47ad-bc81-2e8f4dcce913	true	access.token.claim
b75ba788-217a-47ad-bc81-2e8f4dcce913	email_verified	claim.name
b75ba788-217a-47ad-bc81-2e8f4dcce913	boolean	jsonType.label
c83418a1-6b68-4fd7-8b97-d22f0e2e0ad0	formatted	user.attribute.formatted
c83418a1-6b68-4fd7-8b97-d22f0e2e0ad0	country	user.attribute.country
c83418a1-6b68-4fd7-8b97-d22f0e2e0ad0	postal_code	user.attribute.postal_code
c83418a1-6b68-4fd7-8b97-d22f0e2e0ad0	true	userinfo.token.claim
c83418a1-6b68-4fd7-8b97-d22f0e2e0ad0	street	user.attribute.street
c83418a1-6b68-4fd7-8b97-d22f0e2e0ad0	true	id.token.claim
c83418a1-6b68-4fd7-8b97-d22f0e2e0ad0	region	user.attribute.region
c83418a1-6b68-4fd7-8b97-d22f0e2e0ad0	true	access.token.claim
c83418a1-6b68-4fd7-8b97-d22f0e2e0ad0	locality	user.attribute.locality
13c34a80-7711-4a0d-97b0-b29a501294fa	true	userinfo.token.claim
13c34a80-7711-4a0d-97b0-b29a501294fa	phoneNumber	user.attribute
13c34a80-7711-4a0d-97b0-b29a501294fa	true	id.token.claim
13c34a80-7711-4a0d-97b0-b29a501294fa	true	access.token.claim
13c34a80-7711-4a0d-97b0-b29a501294fa	phone_number	claim.name
13c34a80-7711-4a0d-97b0-b29a501294fa	String	jsonType.label
b4854867-3bfb-409b-92a8-6ec37db17f99	true	userinfo.token.claim
b4854867-3bfb-409b-92a8-6ec37db17f99	phoneNumberVerified	user.attribute
b4854867-3bfb-409b-92a8-6ec37db17f99	true	id.token.claim
b4854867-3bfb-409b-92a8-6ec37db17f99	true	access.token.claim
b4854867-3bfb-409b-92a8-6ec37db17f99	phone_number_verified	claim.name
b4854867-3bfb-409b-92a8-6ec37db17f99	boolean	jsonType.label
1fc8999a-04d9-421b-8557-e417a3750358	true	multivalued
1fc8999a-04d9-421b-8557-e417a3750358	foo	user.attribute
1fc8999a-04d9-421b-8557-e417a3750358	true	access.token.claim
1fc8999a-04d9-421b-8557-e417a3750358	String	jsonType.label
f03cac68-3f0e-4068-9adf-ee64567689a7	true	userinfo.token.claim
f03cac68-3f0e-4068-9adf-ee64567689a7	username	user.attribute
f03cac68-3f0e-4068-9adf-ee64567689a7	true	id.token.claim
f03cac68-3f0e-4068-9adf-ee64567689a7	true	access.token.claim
f03cac68-3f0e-4068-9adf-ee64567689a7	upn	claim.name
f03cac68-3f0e-4068-9adf-ee64567689a7	String	jsonType.label
04183ee1-b558-4f63-839f-922d30b34a9e	true	multivalued
04183ee1-b558-4f63-839f-922d30b34a9e	foo	user.attribute
04183ee1-b558-4f63-839f-922d30b34a9e	true	id.token.claim
04183ee1-b558-4f63-839f-922d30b34a9e	true	access.token.claim
04183ee1-b558-4f63-839f-922d30b34a9e	groups	claim.name
04183ee1-b558-4f63-839f-922d30b34a9e	String	jsonType.label
df78645e-c32b-4160-b79f-42e622d71982	true	userinfo.token.claim
df78645e-c32b-4160-b79f-42e622d71982	locale	user.attribute
df78645e-c32b-4160-b79f-42e622d71982	true	id.token.claim
df78645e-c32b-4160-b79f-42e622d71982	true	access.token.claim
df78645e-c32b-4160-b79f-42e622d71982	locale	claim.name
df78645e-c32b-4160-b79f-42e622d71982	String	jsonType.label
0108b99f-2f31-4e73-9597-cb29e0e8c486	true	userinfo.token.claim
0108b99f-2f31-4e73-9597-cb29e0e8c486	username	user.attribute
0108b99f-2f31-4e73-9597-cb29e0e8c486	true	id.token.claim
0108b99f-2f31-4e73-9597-cb29e0e8c486	true	access.token.claim
0108b99f-2f31-4e73-9597-cb29e0e8c486	preferred_username	claim.name
0108b99f-2f31-4e73-9597-cb29e0e8c486	String	jsonType.label
1fc8999a-04d9-421b-8557-e417a3750358	true	userinfo.token.claim
1fc8999a-04d9-421b-8557-e417a3750358	roles	claim.name
70b0a264-a7c3-43ff-b24f-14ca4f5f118e	true	userinfo.token.claim
70b0a264-a7c3-43ff-b24f-14ca4f5f118e	username	user.attribute
70b0a264-a7c3-43ff-b24f-14ca4f5f118e	true	id.token.claim
70b0a264-a7c3-43ff-b24f-14ca4f5f118e	true	access.token.claim
70b0a264-a7c3-43ff-b24f-14ca4f5f118e	login	claim.name
70b0a264-a7c3-43ff-b24f-14ca4f5f118e	String	jsonType.label
2f8ee9af-b6dd-4790-9e7b-cce83a603566	true	id.token.claim
2f8ee9af-b6dd-4790-9e7b-cce83a603566	true	access.token.claim
2f8ee9af-b6dd-4790-9e7b-cce83a603566	true	userinfo.token.claim
1fc8999a-04d9-421b-8557-e417a3750358	true	id.token.claim
\.


--
-- Data for Name: realm; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.realm (id, access_code_lifespan, user_action_lifespan, access_token_lifespan, account_theme, admin_theme, email_theme, enabled, events_enabled, events_expiration, login_theme, name, not_before, password_policy, registration_allowed, remember_me, reset_password_allowed, social, ssl_required, sso_idle_timeout, sso_max_lifespan, update_profile_on_soc_login, verify_email, master_admin_client, login_lifespan, internationalization_enabled, default_locale, reg_email_as_username, admin_events_enabled, admin_events_details_enabled, edit_username_allowed, otp_policy_counter, otp_policy_window, otp_policy_period, otp_policy_digits, otp_policy_alg, otp_policy_type, browser_flow, registration_flow, direct_grant_flow, reset_credentials_flow, client_auth_flow, offline_session_idle_timeout, revoke_refresh_token, access_token_life_implicit, login_with_email_allowed, duplicate_emails_allowed, docker_auth_flow, refresh_token_max_reuse, allow_user_managed_access, sso_max_lifespan_remember_me, sso_idle_timeout_remember_me) FROM stdin;
master	60	300	60	\N	\N	\N	t	f	0	\N	master	1643820855	\N	f	f	f	f	EXTERNAL	1800	36000	f	f	3cd285ea-0f6e-43b6-ab5c-d021c33a551b	1800	f	\N	f	f	f	f	0	1	30	6	HmacSHA1	totp	ef998ef5-ca12-45db-a252-2e71b1419039	1695e7d2-ad80-4502-8479-8121a6e2a2f0	5f6f801e-0588-4a6e-860a-35483f5c1ec7	954b046d-2b24-405e-84ee-c44ffe603df2	023dc515-c259-42bb-88a8-2e8d84abca92	2592000	f	900	t	f	032b05cf-0007-44da-a370-b42039f6b762	0	f	0	0
grafana	60	300	300	\N	\N	\N	t	f	0	\N	grafana	1643820879	\N	f	f	f	f	EXTERNAL	1800	36000	f	f	ef7f6eac-9fff-44aa-a86c-5125d52acc82	1800	f	\N	f	f	f	f	0	1	30	6	HmacSHA1	totp	a38aeb47-f27e-4e68-82ff-7cc7371a47a7	9d02badd-cb1c-4655-bf5e-f888861433ff	b478ecfb-db7e-4797-a245-8fc3b4dec884	3085fb68-fc1f-4e1c-a8be-33fb45194b04	cbb4b3ca-ced6-4046-8b59-f1c3959c7948	2592000	f	900	t	f	95e02703-f5bc-4e04-8bef-f6adc2d8173f	0	f	0	0
\.


--
-- Data for Name: realm_attribute; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.realm_attribute (name, value, realm_id) FROM stdin;
_browser_header.contentSecurityPolicyReportOnly		master
_browser_header.xContentTypeOptions	nosniff	master
_browser_header.xRobotsTag	none	master
_browser_header.xFrameOptions	SAMEORIGIN	master
_browser_header.contentSecurityPolicy	frame-src 'self'; frame-ancestors 'self'; object-src 'none';	master
_browser_header.xXSSProtection	1; mode=block	master
_browser_header.strictTransportSecurity	max-age=31536000; includeSubDomains	master
bruteForceProtected	false	master
permanentLockout	false	master
maxFailureWaitSeconds	900	master
minimumQuickLoginWaitSeconds	60	master
waitIncrementSeconds	60	master
quickLoginCheckMilliSeconds	1000	master
maxDeltaTimeSeconds	43200	master
failureFactor	30	master
displayName	Keycloak	master
displayNameHtml	<div class="kc-logo-text"><span>Keycloak</span></div>	master
offlineSessionMaxLifespanEnabled	false	master
offlineSessionMaxLifespan	5184000	master
_browser_header.contentSecurityPolicyReportOnly		grafana
_browser_header.xContentTypeOptions	nosniff	grafana
_browser_header.xRobotsTag	none	grafana
_browser_header.xFrameOptions	SAMEORIGIN	grafana
_browser_header.contentSecurityPolicy	frame-src 'self'; frame-ancestors 'self'; object-src 'none';	grafana
_browser_header.xXSSProtection	1; mode=block	grafana
_browser_header.strictTransportSecurity	max-age=31536000; includeSubDomains	grafana
bruteForceProtected	false	grafana
permanentLockout	false	grafana
maxFailureWaitSeconds	900	grafana
minimumQuickLoginWaitSeconds	60	grafana
waitIncrementSeconds	60	grafana
quickLoginCheckMilliSeconds	1000	grafana
maxDeltaTimeSeconds	43200	grafana
failureFactor	30	grafana
offlineSessionMaxLifespanEnabled	false	grafana
offlineSessionMaxLifespan	5184000	grafana
actionTokenGeneratedByAdminLifespan	43200	grafana
actionTokenGeneratedByUserLifespan	300	grafana
webAuthnPolicyRpEntityName	keycloak	grafana
webAuthnPolicySignatureAlgorithms	ES256	grafana
webAuthnPolicyRpId		grafana
webAuthnPolicyAttestationConveyancePreference	not specified	grafana
webAuthnPolicyAuthenticatorAttachment	not specified	grafana
webAuthnPolicyRequireResidentKey	not specified	grafana
webAuthnPolicyUserVerificationRequirement	not specified	grafana
webAuthnPolicyCreateTimeout	0	grafana
webAuthnPolicyAvoidSameAuthenticatorRegister	false	grafana
webAuthnPolicyRpEntityNamePasswordless	keycloak	grafana
webAuthnPolicySignatureAlgorithmsPasswordless	ES256	grafana
webAuthnPolicyRpIdPasswordless		grafana
webAuthnPolicyAttestationConveyancePreferencePasswordless	not specified	grafana
webAuthnPolicyAuthenticatorAttachmentPasswordless	not specified	grafana
webAuthnPolicyRequireResidentKeyPasswordless	not specified	grafana
webAuthnPolicyUserVerificationRequirementPasswordless	not specified	grafana
webAuthnPolicyCreateTimeoutPasswordless	0	grafana
webAuthnPolicyAvoidSameAuthenticatorRegisterPasswordless	false	grafana
\.


--
-- Data for Name: realm_default_groups; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.realm_default_groups (realm_id, group_id) FROM stdin;
\.


--
-- Data for Name: realm_default_roles; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.realm_default_roles (realm_id, role_id) FROM stdin;
master	16d5987b-dcbb-4650-8f52-3469f3974846
master	c014bfd1-a210-4e7a-8a26-35d1f5e8f1ed
grafana	c49bddc6-ec92-4caa-bc04-57ba80a92eb9
grafana	0f3d47bb-002a-4cd0-a502-725f224308a7
\.


--
-- Data for Name: realm_enabled_event_types; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.realm_enabled_event_types (realm_id, value) FROM stdin;
\.


--
-- Data for Name: realm_events_listeners; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.realm_events_listeners (realm_id, value) FROM stdin;
master	jboss-logging
grafana	jboss-logging
\.


--
-- Data for Name: realm_localizations; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.realm_localizations (realm_id, locale, texts) FROM stdin;
\.


--
-- Data for Name: realm_required_credential; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.realm_required_credential (type, form_label, input, secret, realm_id) FROM stdin;
password	password	t	t	master
password	password	t	t	grafana
\.


--
-- Data for Name: realm_smtp_config; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.realm_smtp_config (realm_id, value, name) FROM stdin;
\.


--
-- Data for Name: realm_supported_locales; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.realm_supported_locales (realm_id, value) FROM stdin;
\.


--
-- Data for Name: redirect_uris; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.redirect_uris (client_id, value) FROM stdin;
eed689c6-49da-4d91-98eb-cd495bcc07a3	/realms/master/account/*
11c67f5b-dde7-4680-b05b-c9c59d78bda4	/realms/master/account/*
2f521d09-7304-4b5e-a94b-7cc7300b8b50	/admin/master/console/*
a5a8fed6-0bca-4646-9946-2fe84175353b	/realms/grafana/account/*
230081b5-9161-45c3-9e08-9eda5412f7f7	/realms/grafana/account/*
805aebc8-9d01-42b6-bcce-6ce48ca63ef0	/admin/grafana/console/*
169f1dea-80f0-4a99-8509-9abb70ab0a5c	http://localhost:4200/*
09b79548-8426-4c0e-8e0b-7488467532c7	http://env.grafana.local:8088/oauth2/callback
\.


--
-- Data for Name: required_action_config; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.required_action_config (required_action_id, value, name) FROM stdin;
\.


--
-- Data for Name: required_action_provider; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.required_action_provider (id, alias, name, realm_id, enabled, default_action, provider_id, priority) FROM stdin;
ad4dfd2c-307a-4563-b93a-0bb726b4ccaa	VERIFY_EMAIL	Verify Email	master	t	f	VERIFY_EMAIL	50
2c7fffa4-ff20-4015-9a97-cc6a19e698ba	UPDATE_PROFILE	Update Profile	master	t	f	UPDATE_PROFILE	40
c76d17f4-eacf-497a-ab5a-f78936bbc50e	CONFIGURE_TOTP	Configure OTP	master	t	f	CONFIGURE_TOTP	10
83de9f97-43df-4265-982c-5414a2b19985	UPDATE_PASSWORD	Update Password	master	t	f	UPDATE_PASSWORD	30
9f538737-770e-4731-abd9-e98172a85d2f	terms_and_conditions	Terms and Conditions	master	f	f	terms_and_conditions	20
306fc47e-d8ae-4bb1-b2bc-53608a44536c	update_user_locale	Update User Locale	master	t	f	update_user_locale	1000
f158f7d8-8b7f-414c-b1bd-0dde83c91133	delete_account	Delete Account	master	f	f	delete_account	60
969a57d1-c906-4f49-87d6-3cbba2f3898a	VERIFY_EMAIL	Verify Email	grafana	t	f	VERIFY_EMAIL	50
233d5b8e-6f36-450f-bffd-43b82e27295c	UPDATE_PROFILE	Update Profile	grafana	t	f	UPDATE_PROFILE	40
ab3a9aa7-3d1b-4fb1-93ad-9412142deed3	CONFIGURE_TOTP	Configure OTP	grafana	t	f	CONFIGURE_TOTP	10
988d8e0d-35ef-4e6a-8b48-821cca56acf2	UPDATE_PASSWORD	Update Password	grafana	t	f	UPDATE_PASSWORD	30
0e2b6144-5c2c-4dcb-92d8-00529b19a7a5	terms_and_conditions	Terms and Conditions	grafana	f	f	terms_and_conditions	20
94993a02-f883-4f8a-a549-d48f95aabed2	update_user_locale	Update User Locale	grafana	t	f	update_user_locale	1000
72d09b7f-acde-4b90-af9a-ea3c642a2f6d	delete_account	Delete Account	grafana	f	f	delete_account	60
\.


--
-- Data for Name: resource_attribute; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.resource_attribute (id, name, value, resource_id) FROM stdin;
\.


--
-- Data for Name: resource_policy; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.resource_policy (resource_id, policy_id) FROM stdin;
\.


--
-- Data for Name: resource_scope; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.resource_scope (resource_id, scope_id) FROM stdin;
\.


--
-- Data for Name: resource_server; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.resource_server (id, allow_rs_remote_mgmt, policy_enforce_mode, decision_strategy) FROM stdin;
\.


--
-- Data for Name: resource_server_perm_ticket; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.resource_server_perm_ticket (id, owner, requester, created_timestamp, granted_timestamp, resource_id, scope_id, resource_server_id, policy_id) FROM stdin;
\.


--
-- Data for Name: resource_server_policy; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.resource_server_policy (id, name, description, type, decision_strategy, logic, resource_server_id, owner) FROM stdin;
\.


--
-- Data for Name: resource_server_resource; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.resource_server_resource (id, name, type, icon_uri, owner, resource_server_id, owner_managed_access, display_name) FROM stdin;
\.


--
-- Data for Name: resource_server_scope; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.resource_server_scope (id, name, icon_uri, resource_server_id, display_name) FROM stdin;
\.


--
-- Data for Name: resource_uris; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.resource_uris (resource_id, value) FROM stdin;
\.


--
-- Data for Name: role_attribute; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.role_attribute (id, role_id, name, value) FROM stdin;
\.


--
-- Data for Name: scope_mapping; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.scope_mapping (client_id, role_id) FROM stdin;
11c67f5b-dde7-4680-b05b-c9c59d78bda4	619ba870-921e-4f28-b26c-89b11f39dddf
230081b5-9161-45c3-9e08-9eda5412f7f7	18a7066b-fe71-410e-9581-69f78347ec29
\.


--
-- Data for Name: scope_policy; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.scope_policy (scope_id, policy_id) FROM stdin;
\.


--
-- Data for Name: user_attribute; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.user_attribute (name, value, user_id, id) FROM stdin;
\.


--
-- Data for Name: user_consent; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.user_consent (id, client_id, user_id, created_date, last_updated_date, client_storage_provider, external_client_id) FROM stdin;
\.


--
-- Data for Name: user_consent_client_scope; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.user_consent_client_scope (user_consent_id, scope_id) FROM stdin;
\.


--
-- Data for Name: user_entity; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.user_entity (id, email, email_constraint, email_verified, enabled, federation_link, first_name, last_name, realm_id, username, created_timestamp, service_account_client_link, not_before) FROM stdin;
74e29604-ff35-42bb-a26d-4d0b81ef0917	\N	c8a5d425-4bad-4b76-8828-0e39bae03b67	f	t	\N	\N	\N	master	admin	1643820449683	\N	0
6db3c5e5-b84b-4f9d-a7a8-8d05b03c929d	jwt-admin@example.org	jwt-admin@example.org	f	t	\N	Admin	JWT	grafana	jwt-admin	1657026796311	\N	0
88692d07-bb9a-46cf-844c-7ff5c529cd04	jwt-editor@example.com	jwt-editor@example.com	f	t	\N	Editor	JWT	grafana	jwt-editor	1657026894275	\N	0
8f58cbec-6e40-4bab-bff0-1c5ff899fe2e	jwt-viewer@example.com	jwt-viewer@example.com	f	t	\N	Viewer	JWT	grafana	jwt-viewer	1657026933578	\N	0
\.


--
-- Data for Name: user_federation_config; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.user_federation_config (user_federation_provider_id, value, name) FROM stdin;
\.


--
-- Data for Name: user_federation_mapper; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.user_federation_mapper (id, name, federation_provider_id, federation_mapper_type, realm_id) FROM stdin;
\.


--
-- Data for Name: user_federation_mapper_config; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.user_federation_mapper_config (user_federation_mapper_id, value, name) FROM stdin;
\.


--
-- Data for Name: user_federation_provider; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.user_federation_provider (id, changed_sync_period, display_name, full_sync_period, last_sync, priority, provider_name, realm_id) FROM stdin;
\.


--
-- Data for Name: user_group_membership; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.user_group_membership (group_id, user_id) FROM stdin;
\.


--
-- Data for Name: user_required_action; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.user_required_action (user_id, required_action) FROM stdin;
\.


--
-- Data for Name: user_role_mapping; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.user_role_mapping (role_id, user_id) FROM stdin;
16d5987b-dcbb-4650-8f52-3469f3974846	74e29604-ff35-42bb-a26d-4d0b81ef0917
c014bfd1-a210-4e7a-8a26-35d1f5e8f1ed	74e29604-ff35-42bb-a26d-4d0b81ef0917
86a4b6a9-93db-4177-a72f-95fd937a2c8d	74e29604-ff35-42bb-a26d-4d0b81ef0917
619ba870-921e-4f28-b26c-89b11f39dddf	74e29604-ff35-42bb-a26d-4d0b81ef0917
4a3204aa-320e-4584-b8ee-ea2989b3f330	74e29604-ff35-42bb-a26d-4d0b81ef0917
c49bddc6-ec92-4caa-bc04-57ba80a92eb9	6db3c5e5-b84b-4f9d-a7a8-8d05b03c929d
0f3d47bb-002a-4cd0-a502-725f224308a7	6db3c5e5-b84b-4f9d-a7a8-8d05b03c929d
f1311ecb-6a6a-49d6-bb16-5132daf93a64	6db3c5e5-b84b-4f9d-a7a8-8d05b03c929d
18a7066b-fe71-410e-9581-69f78347ec29	6db3c5e5-b84b-4f9d-a7a8-8d05b03c929d
60f1b1ea-9059-41ea-acef-573643b24709	6db3c5e5-b84b-4f9d-a7a8-8d05b03c929d
c49bddc6-ec92-4caa-bc04-57ba80a92eb9	88692d07-bb9a-46cf-844c-7ff5c529cd04
0f3d47bb-002a-4cd0-a502-725f224308a7	88692d07-bb9a-46cf-844c-7ff5c529cd04
f1311ecb-6a6a-49d6-bb16-5132daf93a64	88692d07-bb9a-46cf-844c-7ff5c529cd04
18a7066b-fe71-410e-9581-69f78347ec29	88692d07-bb9a-46cf-844c-7ff5c529cd04
c49bddc6-ec92-4caa-bc04-57ba80a92eb9	8f58cbec-6e40-4bab-bff0-1c5ff899fe2e
0f3d47bb-002a-4cd0-a502-725f224308a7	8f58cbec-6e40-4bab-bff0-1c5ff899fe2e
f1311ecb-6a6a-49d6-bb16-5132daf93a64	8f58cbec-6e40-4bab-bff0-1c5ff899fe2e
18a7066b-fe71-410e-9581-69f78347ec29	8f58cbec-6e40-4bab-bff0-1c5ff899fe2e
c9a776f9-2740-435f-a725-4dbcc17a6c91	8f58cbec-6e40-4bab-bff0-1c5ff899fe2e
c4c74006-c346-48cf-8cf1-1617e3e1cde1	88692d07-bb9a-46cf-844c-7ff5c529cd04
\.


--
-- Data for Name: user_session; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.user_session (id, auth_method, ip_address, last_session_refresh, login_username, realm_id, remember_me, started, user_id, user_session_state, broker_session_id, broker_user_id) FROM stdin;
\.


--
-- Data for Name: user_session_note; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.user_session_note (user_session, name, value) FROM stdin;
\.


--
-- Data for Name: username_login_failure; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.username_login_failure (realm_id, username, failed_login_not_before, last_failure, last_ip_failure, num_failures) FROM stdin;
\.


--
-- Data for Name: web_origins; Type: TABLE DATA; Schema: public; Owner: keycloak
--

COPY public.web_origins (client_id, value) FROM stdin;
2f521d09-7304-4b5e-a94b-7cc7300b8b50	+
805aebc8-9d01-42b6-bcce-6ce48ca63ef0	+
169f1dea-80f0-4a99-8509-9abb70ab0a5c	http://localhost:4200
09b79548-8426-4c0e-8e0b-7488467532c7	http://env.grafana.local:8087
\.


--
-- Name: username_login_failure CONSTRAINT_17-2; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.username_login_failure
    ADD CONSTRAINT "CONSTRAINT_17-2" PRIMARY KEY (realm_id, username);


--
-- Name: keycloak_role UK_J3RWUVD56ONTGSUHOGM184WW2-2; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.keycloak_role
    ADD CONSTRAINT "UK_J3RWUVD56ONTGSUHOGM184WW2-2" UNIQUE (name, client_realm_constraint);


--
-- Name: client_auth_flow_bindings c_cli_flow_bind; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.client_auth_flow_bindings
    ADD CONSTRAINT c_cli_flow_bind PRIMARY KEY (client_id, binding_name);


--
-- Name: client_scope_client c_cli_scope_bind; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.client_scope_client
    ADD CONSTRAINT c_cli_scope_bind PRIMARY KEY (client_id, scope_id);


--
-- Name: client_initial_access cnstr_client_init_acc_pk; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.client_initial_access
    ADD CONSTRAINT cnstr_client_init_acc_pk PRIMARY KEY (id);


--
-- Name: realm_default_groups con_group_id_def_groups; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.realm_default_groups
    ADD CONSTRAINT con_group_id_def_groups UNIQUE (group_id);


--
-- Name: broker_link constr_broker_link_pk; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.broker_link
    ADD CONSTRAINT constr_broker_link_pk PRIMARY KEY (identity_provider, user_id);


--
-- Name: client_user_session_note constr_cl_usr_ses_note; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.client_user_session_note
    ADD CONSTRAINT constr_cl_usr_ses_note PRIMARY KEY (client_session, name);


--
-- Name: client_default_roles constr_client_default_roles; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.client_default_roles
    ADD CONSTRAINT constr_client_default_roles PRIMARY KEY (client_id, role_id);


--
-- Name: component_config constr_component_config_pk; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.component_config
    ADD CONSTRAINT constr_component_config_pk PRIMARY KEY (id);


--
-- Name: component constr_component_pk; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.component
    ADD CONSTRAINT constr_component_pk PRIMARY KEY (id);


--
-- Name: fed_user_required_action constr_fed_required_action; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.fed_user_required_action
    ADD CONSTRAINT constr_fed_required_action PRIMARY KEY (required_action, user_id);


--
-- Name: fed_user_attribute constr_fed_user_attr_pk; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.fed_user_attribute
    ADD CONSTRAINT constr_fed_user_attr_pk PRIMARY KEY (id);


--
-- Name: fed_user_consent constr_fed_user_consent_pk; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.fed_user_consent
    ADD CONSTRAINT constr_fed_user_consent_pk PRIMARY KEY (id);


--
-- Name: fed_user_credential constr_fed_user_cred_pk; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.fed_user_credential
    ADD CONSTRAINT constr_fed_user_cred_pk PRIMARY KEY (id);


--
-- Name: fed_user_group_membership constr_fed_user_group; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.fed_user_group_membership
    ADD CONSTRAINT constr_fed_user_group PRIMARY KEY (group_id, user_id);


--
-- Name: fed_user_role_mapping constr_fed_user_role; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.fed_user_role_mapping
    ADD CONSTRAINT constr_fed_user_role PRIMARY KEY (role_id, user_id);


--
-- Name: federated_user constr_federated_user; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.federated_user
    ADD CONSTRAINT constr_federated_user PRIMARY KEY (id);


--
-- Name: realm_default_groups constr_realm_default_groups; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.realm_default_groups
    ADD CONSTRAINT constr_realm_default_groups PRIMARY KEY (realm_id, group_id);


--
-- Name: realm_enabled_event_types constr_realm_enabl_event_types; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.realm_enabled_event_types
    ADD CONSTRAINT constr_realm_enabl_event_types PRIMARY KEY (realm_id, value);


--
-- Name: realm_events_listeners constr_realm_events_listeners; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.realm_events_listeners
    ADD CONSTRAINT constr_realm_events_listeners PRIMARY KEY (realm_id, value);


--
-- Name: realm_supported_locales constr_realm_supported_locales; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.realm_supported_locales
    ADD CONSTRAINT constr_realm_supported_locales PRIMARY KEY (realm_id, value);


--
-- Name: identity_provider constraint_2b; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.identity_provider
    ADD CONSTRAINT constraint_2b PRIMARY KEY (internal_id);


--
-- Name: client_attributes constraint_3c; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.client_attributes
    ADD CONSTRAINT constraint_3c PRIMARY KEY (client_id, name);


--
-- Name: event_entity constraint_4; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.event_entity
    ADD CONSTRAINT constraint_4 PRIMARY KEY (id);


--
-- Name: federated_identity constraint_40; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.federated_identity
    ADD CONSTRAINT constraint_40 PRIMARY KEY (identity_provider, user_id);


--
-- Name: realm constraint_4a; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.realm
    ADD CONSTRAINT constraint_4a PRIMARY KEY (id);


--
-- Name: client_session_role constraint_5; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.client_session_role
    ADD CONSTRAINT constraint_5 PRIMARY KEY (client_session, role_id);


--
-- Name: user_session constraint_57; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.user_session
    ADD CONSTRAINT constraint_57 PRIMARY KEY (id);


--
-- Name: user_federation_provider constraint_5c; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.user_federation_provider
    ADD CONSTRAINT constraint_5c PRIMARY KEY (id);


--
-- Name: client_session_note constraint_5e; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.client_session_note
    ADD CONSTRAINT constraint_5e PRIMARY KEY (client_session, name);


--
-- Name: client constraint_7; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.client
    ADD CONSTRAINT constraint_7 PRIMARY KEY (id);


--
-- Name: client_session constraint_8; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.client_session
    ADD CONSTRAINT constraint_8 PRIMARY KEY (id);


--
-- Name: scope_mapping constraint_81; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.scope_mapping
    ADD CONSTRAINT constraint_81 PRIMARY KEY (client_id, role_id);


--
-- Name: client_node_registrations constraint_84; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.client_node_registrations
    ADD CONSTRAINT constraint_84 PRIMARY KEY (client_id, name);


--
-- Name: realm_attribute constraint_9; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.realm_attribute
    ADD CONSTRAINT constraint_9 PRIMARY KEY (name, realm_id);


--
-- Name: realm_required_credential constraint_92; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.realm_required_credential
    ADD CONSTRAINT constraint_92 PRIMARY KEY (realm_id, type);


--
-- Name: keycloak_role constraint_a; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.keycloak_role
    ADD CONSTRAINT constraint_a PRIMARY KEY (id);


--
-- Name: admin_event_entity constraint_admin_event_entity; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.admin_event_entity
    ADD CONSTRAINT constraint_admin_event_entity PRIMARY KEY (id);


--
-- Name: authenticator_config_entry constraint_auth_cfg_pk; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.authenticator_config_entry
    ADD CONSTRAINT constraint_auth_cfg_pk PRIMARY KEY (authenticator_id, name);


--
-- Name: authentication_execution constraint_auth_exec_pk; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.authentication_execution
    ADD CONSTRAINT constraint_auth_exec_pk PRIMARY KEY (id);


--
-- Name: authentication_flow constraint_auth_flow_pk; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.authentication_flow
    ADD CONSTRAINT constraint_auth_flow_pk PRIMARY KEY (id);


--
-- Name: authenticator_config constraint_auth_pk; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.authenticator_config
    ADD CONSTRAINT constraint_auth_pk PRIMARY KEY (id);


--
-- Name: client_session_auth_status constraint_auth_status_pk; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.client_session_auth_status
    ADD CONSTRAINT constraint_auth_status_pk PRIMARY KEY (client_session, authenticator);


--
-- Name: user_role_mapping constraint_c; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.user_role_mapping
    ADD CONSTRAINT constraint_c PRIMARY KEY (role_id, user_id);


--
-- Name: composite_role constraint_composite_role; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.composite_role
    ADD CONSTRAINT constraint_composite_role PRIMARY KEY (composite, child_role);


--
-- Name: client_session_prot_mapper constraint_cs_pmp_pk; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.client_session_prot_mapper
    ADD CONSTRAINT constraint_cs_pmp_pk PRIMARY KEY (client_session, protocol_mapper_id);


--
-- Name: identity_provider_config constraint_d; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.identity_provider_config
    ADD CONSTRAINT constraint_d PRIMARY KEY (identity_provider_id, name);


--
-- Name: policy_config constraint_dpc; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.policy_config
    ADD CONSTRAINT constraint_dpc PRIMARY KEY (policy_id, name);


--
-- Name: realm_smtp_config constraint_e; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.realm_smtp_config
    ADD CONSTRAINT constraint_e PRIMARY KEY (realm_id, name);


--
-- Name: credential constraint_f; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.credential
    ADD CONSTRAINT constraint_f PRIMARY KEY (id);


--
-- Name: user_federation_config constraint_f9; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.user_federation_config
    ADD CONSTRAINT constraint_f9 PRIMARY KEY (user_federation_provider_id, name);


--
-- Name: resource_server_perm_ticket constraint_fapmt; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.resource_server_perm_ticket
    ADD CONSTRAINT constraint_fapmt PRIMARY KEY (id);


--
-- Name: resource_server_resource constraint_farsr; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.resource_server_resource
    ADD CONSTRAINT constraint_farsr PRIMARY KEY (id);


--
-- Name: resource_server_policy constraint_farsrp; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.resource_server_policy
    ADD CONSTRAINT constraint_farsrp PRIMARY KEY (id);


--
-- Name: associated_policy constraint_farsrpap; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.associated_policy
    ADD CONSTRAINT constraint_farsrpap PRIMARY KEY (policy_id, associated_policy_id);


--
-- Name: resource_policy constraint_farsrpp; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.resource_policy
    ADD CONSTRAINT constraint_farsrpp PRIMARY KEY (resource_id, policy_id);


--
-- Name: resource_server_scope constraint_farsrs; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.resource_server_scope
    ADD CONSTRAINT constraint_farsrs PRIMARY KEY (id);


--
-- Name: resource_scope constraint_farsrsp; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.resource_scope
    ADD CONSTRAINT constraint_farsrsp PRIMARY KEY (resource_id, scope_id);


--
-- Name: scope_policy constraint_farsrsps; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.scope_policy
    ADD CONSTRAINT constraint_farsrsps PRIMARY KEY (scope_id, policy_id);


--
-- Name: user_entity constraint_fb; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.user_entity
    ADD CONSTRAINT constraint_fb PRIMARY KEY (id);


--
-- Name: user_federation_mapper_config constraint_fedmapper_cfg_pm; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.user_federation_mapper_config
    ADD CONSTRAINT constraint_fedmapper_cfg_pm PRIMARY KEY (user_federation_mapper_id, name);


--
-- Name: user_federation_mapper constraint_fedmapperpm; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.user_federation_mapper
    ADD CONSTRAINT constraint_fedmapperpm PRIMARY KEY (id);


--
-- Name: fed_user_consent_cl_scope constraint_fgrntcsnt_clsc_pm; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.fed_user_consent_cl_scope
    ADD CONSTRAINT constraint_fgrntcsnt_clsc_pm PRIMARY KEY (user_consent_id, scope_id);


--
-- Name: user_consent_client_scope constraint_grntcsnt_clsc_pm; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.user_consent_client_scope
    ADD CONSTRAINT constraint_grntcsnt_clsc_pm PRIMARY KEY (user_consent_id, scope_id);


--
-- Name: user_consent constraint_grntcsnt_pm; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.user_consent
    ADD CONSTRAINT constraint_grntcsnt_pm PRIMARY KEY (id);


--
-- Name: keycloak_group constraint_group; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.keycloak_group
    ADD CONSTRAINT constraint_group PRIMARY KEY (id);


--
-- Name: group_attribute constraint_group_attribute_pk; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.group_attribute
    ADD CONSTRAINT constraint_group_attribute_pk PRIMARY KEY (id);


--
-- Name: group_role_mapping constraint_group_role; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.group_role_mapping
    ADD CONSTRAINT constraint_group_role PRIMARY KEY (role_id, group_id);


--
-- Name: identity_provider_mapper constraint_idpm; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.identity_provider_mapper
    ADD CONSTRAINT constraint_idpm PRIMARY KEY (id);


--
-- Name: idp_mapper_config constraint_idpmconfig; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.idp_mapper_config
    ADD CONSTRAINT constraint_idpmconfig PRIMARY KEY (idp_mapper_id, name);


--
-- Name: migration_model constraint_migmod; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.migration_model
    ADD CONSTRAINT constraint_migmod PRIMARY KEY (id);


--
-- Name: offline_client_session constraint_offl_cl_ses_pk3; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.offline_client_session
    ADD CONSTRAINT constraint_offl_cl_ses_pk3 PRIMARY KEY (user_session_id, client_id, client_storage_provider, external_client_id, offline_flag);


--
-- Name: offline_user_session constraint_offl_us_ses_pk2; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.offline_user_session
    ADD CONSTRAINT constraint_offl_us_ses_pk2 PRIMARY KEY (user_session_id, offline_flag);


--
-- Name: protocol_mapper constraint_pcm; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.protocol_mapper
    ADD CONSTRAINT constraint_pcm PRIMARY KEY (id);


--
-- Name: protocol_mapper_config constraint_pmconfig; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.protocol_mapper_config
    ADD CONSTRAINT constraint_pmconfig PRIMARY KEY (protocol_mapper_id, name);


--
-- Name: realm_default_roles constraint_realm_default_roles; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.realm_default_roles
    ADD CONSTRAINT constraint_realm_default_roles PRIMARY KEY (realm_id, role_id);


--
-- Name: redirect_uris constraint_redirect_uris; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.redirect_uris
    ADD CONSTRAINT constraint_redirect_uris PRIMARY KEY (client_id, value);


--
-- Name: required_action_config constraint_req_act_cfg_pk; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.required_action_config
    ADD CONSTRAINT constraint_req_act_cfg_pk PRIMARY KEY (required_action_id, name);


--
-- Name: required_action_provider constraint_req_act_prv_pk; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.required_action_provider
    ADD CONSTRAINT constraint_req_act_prv_pk PRIMARY KEY (id);


--
-- Name: user_required_action constraint_required_action; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.user_required_action
    ADD CONSTRAINT constraint_required_action PRIMARY KEY (required_action, user_id);


--
-- Name: resource_uris constraint_resour_uris_pk; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.resource_uris
    ADD CONSTRAINT constraint_resour_uris_pk PRIMARY KEY (resource_id, value);


--
-- Name: role_attribute constraint_role_attribute_pk; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.role_attribute
    ADD CONSTRAINT constraint_role_attribute_pk PRIMARY KEY (id);


--
-- Name: user_attribute constraint_user_attribute_pk; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.user_attribute
    ADD CONSTRAINT constraint_user_attribute_pk PRIMARY KEY (id);


--
-- Name: user_group_membership constraint_user_group; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.user_group_membership
    ADD CONSTRAINT constraint_user_group PRIMARY KEY (group_id, user_id);


--
-- Name: user_session_note constraint_usn_pk; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.user_session_note
    ADD CONSTRAINT constraint_usn_pk PRIMARY KEY (user_session, name);


--
-- Name: web_origins constraint_web_origins; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.web_origins
    ADD CONSTRAINT constraint_web_origins PRIMARY KEY (client_id, value);


--
-- Name: client_scope_attributes pk_cl_tmpl_attr; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.client_scope_attributes
    ADD CONSTRAINT pk_cl_tmpl_attr PRIMARY KEY (scope_id, name);


--
-- Name: client_scope pk_cli_template; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.client_scope
    ADD CONSTRAINT pk_cli_template PRIMARY KEY (id);


--
-- Name: databasechangeloglock pk_databasechangeloglock; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.databasechangeloglock
    ADD CONSTRAINT pk_databasechangeloglock PRIMARY KEY (id);


--
-- Name: resource_server pk_resource_server; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.resource_server
    ADD CONSTRAINT pk_resource_server PRIMARY KEY (id);


--
-- Name: client_scope_role_mapping pk_template_scope; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.client_scope_role_mapping
    ADD CONSTRAINT pk_template_scope PRIMARY KEY (scope_id, role_id);


--
-- Name: default_client_scope r_def_cli_scope_bind; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.default_client_scope
    ADD CONSTRAINT r_def_cli_scope_bind PRIMARY KEY (realm_id, scope_id);


--
-- Name: realm_localizations realm_localizations_pkey; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.realm_localizations
    ADD CONSTRAINT realm_localizations_pkey PRIMARY KEY (realm_id, locale);


--
-- Name: resource_attribute res_attr_pk; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.resource_attribute
    ADD CONSTRAINT res_attr_pk PRIMARY KEY (id);


--
-- Name: keycloak_group sibling_names; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.keycloak_group
    ADD CONSTRAINT sibling_names UNIQUE (realm_id, parent_group, name);


--
-- Name: identity_provider uk_2daelwnibji49avxsrtuf6xj33; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.identity_provider
    ADD CONSTRAINT uk_2daelwnibji49avxsrtuf6xj33 UNIQUE (provider_alias, realm_id);


--
-- Name: client_default_roles uk_8aelwnibji49avxsrtuf6xjow; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.client_default_roles
    ADD CONSTRAINT uk_8aelwnibji49avxsrtuf6xjow UNIQUE (role_id);


--
-- Name: client uk_b71cjlbenv945rb6gcon438at; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.client
    ADD CONSTRAINT uk_b71cjlbenv945rb6gcon438at UNIQUE (realm_id, client_id);


--
-- Name: client_scope uk_cli_scope; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.client_scope
    ADD CONSTRAINT uk_cli_scope UNIQUE (realm_id, name);


--
-- Name: user_entity uk_dykn684sl8up1crfei6eckhd7; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.user_entity
    ADD CONSTRAINT uk_dykn684sl8up1crfei6eckhd7 UNIQUE (realm_id, email_constraint);


--
-- Name: resource_server_resource uk_frsr6t700s9v50bu18ws5ha6; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.resource_server_resource
    ADD CONSTRAINT uk_frsr6t700s9v50bu18ws5ha6 UNIQUE (name, owner, resource_server_id);


--
-- Name: resource_server_perm_ticket uk_frsr6t700s9v50bu18ws5pmt; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.resource_server_perm_ticket
    ADD CONSTRAINT uk_frsr6t700s9v50bu18ws5pmt UNIQUE (owner, requester, resource_server_id, resource_id, scope_id);


--
-- Name: resource_server_policy uk_frsrpt700s9v50bu18ws5ha6; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.resource_server_policy
    ADD CONSTRAINT uk_frsrpt700s9v50bu18ws5ha6 UNIQUE (name, resource_server_id);


--
-- Name: resource_server_scope uk_frsrst700s9v50bu18ws5ha6; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.resource_server_scope
    ADD CONSTRAINT uk_frsrst700s9v50bu18ws5ha6 UNIQUE (name, resource_server_id);


--
-- Name: realm_default_roles uk_h4wpd7w4hsoolni3h0sw7btje; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.realm_default_roles
    ADD CONSTRAINT uk_h4wpd7w4hsoolni3h0sw7btje UNIQUE (role_id);


--
-- Name: user_consent uk_jkuwuvd56ontgsuhogm8uewrt; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.user_consent
    ADD CONSTRAINT uk_jkuwuvd56ontgsuhogm8uewrt UNIQUE (client_id, client_storage_provider, external_client_id, user_id);


--
-- Name: realm uk_orvsdmla56612eaefiq6wl5oi; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.realm
    ADD CONSTRAINT uk_orvsdmla56612eaefiq6wl5oi UNIQUE (name);


--
-- Name: user_entity uk_ru8tt6t700s9v50bu18ws5ha6; Type: CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.user_entity
    ADD CONSTRAINT uk_ru8tt6t700s9v50bu18ws5ha6 UNIQUE (realm_id, username);


--
-- Name: idx_assoc_pol_assoc_pol_id; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_assoc_pol_assoc_pol_id ON public.associated_policy USING btree (associated_policy_id);


--
-- Name: idx_auth_config_realm; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_auth_config_realm ON public.authenticator_config USING btree (realm_id);


--
-- Name: idx_auth_exec_flow; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_auth_exec_flow ON public.authentication_execution USING btree (flow_id);


--
-- Name: idx_auth_exec_realm_flow; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_auth_exec_realm_flow ON public.authentication_execution USING btree (realm_id, flow_id);


--
-- Name: idx_auth_flow_realm; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_auth_flow_realm ON public.authentication_flow USING btree (realm_id);


--
-- Name: idx_cl_clscope; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_cl_clscope ON public.client_scope_client USING btree (scope_id);


--
-- Name: idx_client_def_roles_client; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_client_def_roles_client ON public.client_default_roles USING btree (client_id);


--
-- Name: idx_client_id; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_client_id ON public.client USING btree (client_id);


--
-- Name: idx_client_init_acc_realm; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_client_init_acc_realm ON public.client_initial_access USING btree (realm_id);


--
-- Name: idx_client_session_session; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_client_session_session ON public.client_session USING btree (session_id);


--
-- Name: idx_clscope_attrs; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_clscope_attrs ON public.client_scope_attributes USING btree (scope_id);


--
-- Name: idx_clscope_cl; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_clscope_cl ON public.client_scope_client USING btree (client_id);


--
-- Name: idx_clscope_protmap; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_clscope_protmap ON public.protocol_mapper USING btree (client_scope_id);


--
-- Name: idx_clscope_role; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_clscope_role ON public.client_scope_role_mapping USING btree (scope_id);


--
-- Name: idx_compo_config_compo; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_compo_config_compo ON public.component_config USING btree (component_id);


--
-- Name: idx_component_provider_type; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_component_provider_type ON public.component USING btree (provider_type);


--
-- Name: idx_component_realm; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_component_realm ON public.component USING btree (realm_id);


--
-- Name: idx_composite; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_composite ON public.composite_role USING btree (composite);


--
-- Name: idx_composite_child; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_composite_child ON public.composite_role USING btree (child_role);


--
-- Name: idx_defcls_realm; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_defcls_realm ON public.default_client_scope USING btree (realm_id);


--
-- Name: idx_defcls_scope; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_defcls_scope ON public.default_client_scope USING btree (scope_id);


--
-- Name: idx_event_time; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_event_time ON public.event_entity USING btree (realm_id, event_time);


--
-- Name: idx_fedidentity_feduser; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_fedidentity_feduser ON public.federated_identity USING btree (federated_user_id);


--
-- Name: idx_fedidentity_user; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_fedidentity_user ON public.federated_identity USING btree (user_id);


--
-- Name: idx_fu_attribute; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_fu_attribute ON public.fed_user_attribute USING btree (user_id, realm_id, name);


--
-- Name: idx_fu_cnsnt_ext; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_fu_cnsnt_ext ON public.fed_user_consent USING btree (user_id, client_storage_provider, external_client_id);


--
-- Name: idx_fu_consent; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_fu_consent ON public.fed_user_consent USING btree (user_id, client_id);


--
-- Name: idx_fu_consent_ru; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_fu_consent_ru ON public.fed_user_consent USING btree (realm_id, user_id);


--
-- Name: idx_fu_credential; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_fu_credential ON public.fed_user_credential USING btree (user_id, type);


--
-- Name: idx_fu_credential_ru; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_fu_credential_ru ON public.fed_user_credential USING btree (realm_id, user_id);


--
-- Name: idx_fu_group_membership; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_fu_group_membership ON public.fed_user_group_membership USING btree (user_id, group_id);


--
-- Name: idx_fu_group_membership_ru; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_fu_group_membership_ru ON public.fed_user_group_membership USING btree (realm_id, user_id);


--
-- Name: idx_fu_required_action; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_fu_required_action ON public.fed_user_required_action USING btree (user_id, required_action);


--
-- Name: idx_fu_required_action_ru; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_fu_required_action_ru ON public.fed_user_required_action USING btree (realm_id, user_id);


--
-- Name: idx_fu_role_mapping; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_fu_role_mapping ON public.fed_user_role_mapping USING btree (user_id, role_id);


--
-- Name: idx_fu_role_mapping_ru; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_fu_role_mapping_ru ON public.fed_user_role_mapping USING btree (realm_id, user_id);


--
-- Name: idx_group_attr_group; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_group_attr_group ON public.group_attribute USING btree (group_id);


--
-- Name: idx_group_role_mapp_group; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_group_role_mapp_group ON public.group_role_mapping USING btree (group_id);


--
-- Name: idx_id_prov_mapp_realm; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_id_prov_mapp_realm ON public.identity_provider_mapper USING btree (realm_id);


--
-- Name: idx_ident_prov_realm; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_ident_prov_realm ON public.identity_provider USING btree (realm_id);


--
-- Name: idx_keycloak_role_client; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_keycloak_role_client ON public.keycloak_role USING btree (client);


--
-- Name: idx_keycloak_role_realm; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_keycloak_role_realm ON public.keycloak_role USING btree (realm);


--
-- Name: idx_offline_uss_createdon; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_offline_uss_createdon ON public.offline_user_session USING btree (created_on);


--
-- Name: idx_protocol_mapper_client; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_protocol_mapper_client ON public.protocol_mapper USING btree (client_id);


--
-- Name: idx_realm_attr_realm; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_realm_attr_realm ON public.realm_attribute USING btree (realm_id);


--
-- Name: idx_realm_clscope; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_realm_clscope ON public.client_scope USING btree (realm_id);


--
-- Name: idx_realm_def_grp_realm; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_realm_def_grp_realm ON public.realm_default_groups USING btree (realm_id);


--
-- Name: idx_realm_def_roles_realm; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_realm_def_roles_realm ON public.realm_default_roles USING btree (realm_id);


--
-- Name: idx_realm_evt_list_realm; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_realm_evt_list_realm ON public.realm_events_listeners USING btree (realm_id);


--
-- Name: idx_realm_evt_types_realm; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_realm_evt_types_realm ON public.realm_enabled_event_types USING btree (realm_id);


--
-- Name: idx_realm_master_adm_cli; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_realm_master_adm_cli ON public.realm USING btree (master_admin_client);


--
-- Name: idx_realm_supp_local_realm; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_realm_supp_local_realm ON public.realm_supported_locales USING btree (realm_id);


--
-- Name: idx_redir_uri_client; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_redir_uri_client ON public.redirect_uris USING btree (client_id);


--
-- Name: idx_req_act_prov_realm; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_req_act_prov_realm ON public.required_action_provider USING btree (realm_id);


--
-- Name: idx_res_policy_policy; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_res_policy_policy ON public.resource_policy USING btree (policy_id);


--
-- Name: idx_res_scope_scope; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_res_scope_scope ON public.resource_scope USING btree (scope_id);


--
-- Name: idx_res_serv_pol_res_serv; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_res_serv_pol_res_serv ON public.resource_server_policy USING btree (resource_server_id);


--
-- Name: idx_res_srv_res_res_srv; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_res_srv_res_res_srv ON public.resource_server_resource USING btree (resource_server_id);


--
-- Name: idx_res_srv_scope_res_srv; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_res_srv_scope_res_srv ON public.resource_server_scope USING btree (resource_server_id);


--
-- Name: idx_role_attribute; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_role_attribute ON public.role_attribute USING btree (role_id);


--
-- Name: idx_role_clscope; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_role_clscope ON public.client_scope_role_mapping USING btree (role_id);


--
-- Name: idx_scope_mapping_role; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_scope_mapping_role ON public.scope_mapping USING btree (role_id);


--
-- Name: idx_scope_policy_policy; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_scope_policy_policy ON public.scope_policy USING btree (policy_id);


--
-- Name: idx_update_time; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_update_time ON public.migration_model USING btree (update_time);


--
-- Name: idx_us_sess_id_on_cl_sess; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_us_sess_id_on_cl_sess ON public.offline_client_session USING btree (user_session_id);


--
-- Name: idx_usconsent_clscope; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_usconsent_clscope ON public.user_consent_client_scope USING btree (user_consent_id);


--
-- Name: idx_user_attribute; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_user_attribute ON public.user_attribute USING btree (user_id);


--
-- Name: idx_user_consent; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_user_consent ON public.user_consent USING btree (user_id);


--
-- Name: idx_user_credential; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_user_credential ON public.credential USING btree (user_id);


--
-- Name: idx_user_email; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_user_email ON public.user_entity USING btree (email);


--
-- Name: idx_user_group_mapping; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_user_group_mapping ON public.user_group_membership USING btree (user_id);


--
-- Name: idx_user_reqactions; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_user_reqactions ON public.user_required_action USING btree (user_id);


--
-- Name: idx_user_role_mapping; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_user_role_mapping ON public.user_role_mapping USING btree (user_id);


--
-- Name: idx_usr_fed_map_fed_prv; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_usr_fed_map_fed_prv ON public.user_federation_mapper USING btree (federation_provider_id);


--
-- Name: idx_usr_fed_map_realm; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_usr_fed_map_realm ON public.user_federation_mapper USING btree (realm_id);


--
-- Name: idx_usr_fed_prv_realm; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_usr_fed_prv_realm ON public.user_federation_provider USING btree (realm_id);


--
-- Name: idx_web_orig_client; Type: INDEX; Schema: public; Owner: keycloak
--

CREATE INDEX idx_web_orig_client ON public.web_origins USING btree (client_id);


--
-- Name: client_session_auth_status auth_status_constraint; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.client_session_auth_status
    ADD CONSTRAINT auth_status_constraint FOREIGN KEY (client_session) REFERENCES public.client_session(id);


--
-- Name: identity_provider fk2b4ebc52ae5c3b34; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.identity_provider
    ADD CONSTRAINT fk2b4ebc52ae5c3b34 FOREIGN KEY (realm_id) REFERENCES public.realm(id);


--
-- Name: client_attributes fk3c47c64beacca966; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.client_attributes
    ADD CONSTRAINT fk3c47c64beacca966 FOREIGN KEY (client_id) REFERENCES public.client(id);


--
-- Name: federated_identity fk404288b92ef007a6; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.federated_identity
    ADD CONSTRAINT fk404288b92ef007a6 FOREIGN KEY (user_id) REFERENCES public.user_entity(id);


--
-- Name: client_node_registrations fk4129723ba992f594; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.client_node_registrations
    ADD CONSTRAINT fk4129723ba992f594 FOREIGN KEY (client_id) REFERENCES public.client(id);


--
-- Name: client_session_note fk5edfb00ff51c2736; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.client_session_note
    ADD CONSTRAINT fk5edfb00ff51c2736 FOREIGN KEY (client_session) REFERENCES public.client_session(id);


--
-- Name: user_session_note fk5edfb00ff51d3472; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.user_session_note
    ADD CONSTRAINT fk5edfb00ff51d3472 FOREIGN KEY (user_session) REFERENCES public.user_session(id);


--
-- Name: client_session_role fk_11b7sgqw18i532811v7o2dv76; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.client_session_role
    ADD CONSTRAINT fk_11b7sgqw18i532811v7o2dv76 FOREIGN KEY (client_session) REFERENCES public.client_session(id);


--
-- Name: redirect_uris fk_1burs8pb4ouj97h5wuppahv9f; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.redirect_uris
    ADD CONSTRAINT fk_1burs8pb4ouj97h5wuppahv9f FOREIGN KEY (client_id) REFERENCES public.client(id);


--
-- Name: user_federation_provider fk_1fj32f6ptolw2qy60cd8n01e8; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.user_federation_provider
    ADD CONSTRAINT fk_1fj32f6ptolw2qy60cd8n01e8 FOREIGN KEY (realm_id) REFERENCES public.realm(id);


--
-- Name: client_session_prot_mapper fk_33a8sgqw18i532811v7o2dk89; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.client_session_prot_mapper
    ADD CONSTRAINT fk_33a8sgqw18i532811v7o2dk89 FOREIGN KEY (client_session) REFERENCES public.client_session(id);


--
-- Name: realm_required_credential fk_5hg65lybevavkqfki3kponh9v; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.realm_required_credential
    ADD CONSTRAINT fk_5hg65lybevavkqfki3kponh9v FOREIGN KEY (realm_id) REFERENCES public.realm(id);


--
-- Name: resource_attribute fk_5hrm2vlf9ql5fu022kqepovbr; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.resource_attribute
    ADD CONSTRAINT fk_5hrm2vlf9ql5fu022kqepovbr FOREIGN KEY (resource_id) REFERENCES public.resource_server_resource(id);


--
-- Name: user_attribute fk_5hrm2vlf9ql5fu043kqepovbr; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.user_attribute
    ADD CONSTRAINT fk_5hrm2vlf9ql5fu043kqepovbr FOREIGN KEY (user_id) REFERENCES public.user_entity(id);


--
-- Name: user_required_action fk_6qj3w1jw9cvafhe19bwsiuvmd; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.user_required_action
    ADD CONSTRAINT fk_6qj3w1jw9cvafhe19bwsiuvmd FOREIGN KEY (user_id) REFERENCES public.user_entity(id);


--
-- Name: keycloak_role fk_6vyqfe4cn4wlq8r6kt5vdsj5c; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.keycloak_role
    ADD CONSTRAINT fk_6vyqfe4cn4wlq8r6kt5vdsj5c FOREIGN KEY (realm) REFERENCES public.realm(id);


--
-- Name: realm_smtp_config fk_70ej8xdxgxd0b9hh6180irr0o; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.realm_smtp_config
    ADD CONSTRAINT fk_70ej8xdxgxd0b9hh6180irr0o FOREIGN KEY (realm_id) REFERENCES public.realm(id);


--
-- Name: realm_attribute fk_8shxd6l3e9atqukacxgpffptw; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.realm_attribute
    ADD CONSTRAINT fk_8shxd6l3e9atqukacxgpffptw FOREIGN KEY (realm_id) REFERENCES public.realm(id);


--
-- Name: composite_role fk_a63wvekftu8jo1pnj81e7mce2; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.composite_role
    ADD CONSTRAINT fk_a63wvekftu8jo1pnj81e7mce2 FOREIGN KEY (composite) REFERENCES public.keycloak_role(id);


--
-- Name: authentication_execution fk_auth_exec_flow; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.authentication_execution
    ADD CONSTRAINT fk_auth_exec_flow FOREIGN KEY (flow_id) REFERENCES public.authentication_flow(id);


--
-- Name: authentication_execution fk_auth_exec_realm; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.authentication_execution
    ADD CONSTRAINT fk_auth_exec_realm FOREIGN KEY (realm_id) REFERENCES public.realm(id);


--
-- Name: authentication_flow fk_auth_flow_realm; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.authentication_flow
    ADD CONSTRAINT fk_auth_flow_realm FOREIGN KEY (realm_id) REFERENCES public.realm(id);


--
-- Name: authenticator_config fk_auth_realm; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.authenticator_config
    ADD CONSTRAINT fk_auth_realm FOREIGN KEY (realm_id) REFERENCES public.realm(id);


--
-- Name: client_session fk_b4ao2vcvat6ukau74wbwtfqo1; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.client_session
    ADD CONSTRAINT fk_b4ao2vcvat6ukau74wbwtfqo1 FOREIGN KEY (session_id) REFERENCES public.user_session(id);


--
-- Name: user_role_mapping fk_c4fqv34p1mbylloxang7b1q3l; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.user_role_mapping
    ADD CONSTRAINT fk_c4fqv34p1mbylloxang7b1q3l FOREIGN KEY (user_id) REFERENCES public.user_entity(id);


--
-- Name: client_scope_client fk_c_cli_scope_client; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.client_scope_client
    ADD CONSTRAINT fk_c_cli_scope_client FOREIGN KEY (client_id) REFERENCES public.client(id);


--
-- Name: client_scope_client fk_c_cli_scope_scope; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.client_scope_client
    ADD CONSTRAINT fk_c_cli_scope_scope FOREIGN KEY (scope_id) REFERENCES public.client_scope(id);


--
-- Name: client_scope_attributes fk_cl_scope_attr_scope; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.client_scope_attributes
    ADD CONSTRAINT fk_cl_scope_attr_scope FOREIGN KEY (scope_id) REFERENCES public.client_scope(id);


--
-- Name: client_scope_role_mapping fk_cl_scope_rm_scope; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.client_scope_role_mapping
    ADD CONSTRAINT fk_cl_scope_rm_scope FOREIGN KEY (scope_id) REFERENCES public.client_scope(id);


--
-- Name: client_user_session_note fk_cl_usr_ses_note; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.client_user_session_note
    ADD CONSTRAINT fk_cl_usr_ses_note FOREIGN KEY (client_session) REFERENCES public.client_session(id);


--
-- Name: protocol_mapper fk_cli_scope_mapper; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.protocol_mapper
    ADD CONSTRAINT fk_cli_scope_mapper FOREIGN KEY (client_scope_id) REFERENCES public.client_scope(id);


--
-- Name: client_initial_access fk_client_init_acc_realm; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.client_initial_access
    ADD CONSTRAINT fk_client_init_acc_realm FOREIGN KEY (realm_id) REFERENCES public.realm(id);


--
-- Name: component_config fk_component_config; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.component_config
    ADD CONSTRAINT fk_component_config FOREIGN KEY (component_id) REFERENCES public.component(id);


--
-- Name: component fk_component_realm; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.component
    ADD CONSTRAINT fk_component_realm FOREIGN KEY (realm_id) REFERENCES public.realm(id);


--
-- Name: realm_default_groups fk_def_groups_realm; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.realm_default_groups
    ADD CONSTRAINT fk_def_groups_realm FOREIGN KEY (realm_id) REFERENCES public.realm(id);


--
-- Name: realm_default_roles fk_evudb1ppw84oxfax2drs03icc; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.realm_default_roles
    ADD CONSTRAINT fk_evudb1ppw84oxfax2drs03icc FOREIGN KEY (realm_id) REFERENCES public.realm(id);


--
-- Name: user_federation_mapper_config fk_fedmapper_cfg; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.user_federation_mapper_config
    ADD CONSTRAINT fk_fedmapper_cfg FOREIGN KEY (user_federation_mapper_id) REFERENCES public.user_federation_mapper(id);


--
-- Name: user_federation_mapper fk_fedmapperpm_fedprv; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.user_federation_mapper
    ADD CONSTRAINT fk_fedmapperpm_fedprv FOREIGN KEY (federation_provider_id) REFERENCES public.user_federation_provider(id);


--
-- Name: user_federation_mapper fk_fedmapperpm_realm; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.user_federation_mapper
    ADD CONSTRAINT fk_fedmapperpm_realm FOREIGN KEY (realm_id) REFERENCES public.realm(id);


--
-- Name: associated_policy fk_frsr5s213xcx4wnkog82ssrfy; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.associated_policy
    ADD CONSTRAINT fk_frsr5s213xcx4wnkog82ssrfy FOREIGN KEY (associated_policy_id) REFERENCES public.resource_server_policy(id);


--
-- Name: scope_policy fk_frsrasp13xcx4wnkog82ssrfy; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.scope_policy
    ADD CONSTRAINT fk_frsrasp13xcx4wnkog82ssrfy FOREIGN KEY (policy_id) REFERENCES public.resource_server_policy(id);


--
-- Name: resource_server_perm_ticket fk_frsrho213xcx4wnkog82sspmt; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.resource_server_perm_ticket
    ADD CONSTRAINT fk_frsrho213xcx4wnkog82sspmt FOREIGN KEY (resource_server_id) REFERENCES public.resource_server(id);


--
-- Name: resource_server_resource fk_frsrho213xcx4wnkog82ssrfy; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.resource_server_resource
    ADD CONSTRAINT fk_frsrho213xcx4wnkog82ssrfy FOREIGN KEY (resource_server_id) REFERENCES public.resource_server(id);


--
-- Name: resource_server_perm_ticket fk_frsrho213xcx4wnkog83sspmt; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.resource_server_perm_ticket
    ADD CONSTRAINT fk_frsrho213xcx4wnkog83sspmt FOREIGN KEY (resource_id) REFERENCES public.resource_server_resource(id);


--
-- Name: resource_server_perm_ticket fk_frsrho213xcx4wnkog84sspmt; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.resource_server_perm_ticket
    ADD CONSTRAINT fk_frsrho213xcx4wnkog84sspmt FOREIGN KEY (scope_id) REFERENCES public.resource_server_scope(id);


--
-- Name: associated_policy fk_frsrpas14xcx4wnkog82ssrfy; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.associated_policy
    ADD CONSTRAINT fk_frsrpas14xcx4wnkog82ssrfy FOREIGN KEY (policy_id) REFERENCES public.resource_server_policy(id);


--
-- Name: scope_policy fk_frsrpass3xcx4wnkog82ssrfy; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.scope_policy
    ADD CONSTRAINT fk_frsrpass3xcx4wnkog82ssrfy FOREIGN KEY (scope_id) REFERENCES public.resource_server_scope(id);


--
-- Name: resource_server_perm_ticket fk_frsrpo2128cx4wnkog82ssrfy; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.resource_server_perm_ticket
    ADD CONSTRAINT fk_frsrpo2128cx4wnkog82ssrfy FOREIGN KEY (policy_id) REFERENCES public.resource_server_policy(id);


--
-- Name: resource_server_policy fk_frsrpo213xcx4wnkog82ssrfy; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.resource_server_policy
    ADD CONSTRAINT fk_frsrpo213xcx4wnkog82ssrfy FOREIGN KEY (resource_server_id) REFERENCES public.resource_server(id);


--
-- Name: resource_scope fk_frsrpos13xcx4wnkog82ssrfy; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.resource_scope
    ADD CONSTRAINT fk_frsrpos13xcx4wnkog82ssrfy FOREIGN KEY (resource_id) REFERENCES public.resource_server_resource(id);


--
-- Name: resource_policy fk_frsrpos53xcx4wnkog82ssrfy; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.resource_policy
    ADD CONSTRAINT fk_frsrpos53xcx4wnkog82ssrfy FOREIGN KEY (resource_id) REFERENCES public.resource_server_resource(id);


--
-- Name: resource_policy fk_frsrpp213xcx4wnkog82ssrfy; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.resource_policy
    ADD CONSTRAINT fk_frsrpp213xcx4wnkog82ssrfy FOREIGN KEY (policy_id) REFERENCES public.resource_server_policy(id);


--
-- Name: resource_scope fk_frsrps213xcx4wnkog82ssrfy; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.resource_scope
    ADD CONSTRAINT fk_frsrps213xcx4wnkog82ssrfy FOREIGN KEY (scope_id) REFERENCES public.resource_server_scope(id);


--
-- Name: resource_server_scope fk_frsrso213xcx4wnkog82ssrfy; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.resource_server_scope
    ADD CONSTRAINT fk_frsrso213xcx4wnkog82ssrfy FOREIGN KEY (resource_server_id) REFERENCES public.resource_server(id);


--
-- Name: composite_role fk_gr7thllb9lu8q4vqa4524jjy8; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.composite_role
    ADD CONSTRAINT fk_gr7thllb9lu8q4vqa4524jjy8 FOREIGN KEY (child_role) REFERENCES public.keycloak_role(id);


--
-- Name: user_consent_client_scope fk_grntcsnt_clsc_usc; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.user_consent_client_scope
    ADD CONSTRAINT fk_grntcsnt_clsc_usc FOREIGN KEY (user_consent_id) REFERENCES public.user_consent(id);


--
-- Name: user_consent fk_grntcsnt_user; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.user_consent
    ADD CONSTRAINT fk_grntcsnt_user FOREIGN KEY (user_id) REFERENCES public.user_entity(id);


--
-- Name: group_attribute fk_group_attribute_group; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.group_attribute
    ADD CONSTRAINT fk_group_attribute_group FOREIGN KEY (group_id) REFERENCES public.keycloak_group(id);


--
-- Name: keycloak_group fk_group_realm; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.keycloak_group
    ADD CONSTRAINT fk_group_realm FOREIGN KEY (realm_id) REFERENCES public.realm(id);


--
-- Name: group_role_mapping fk_group_role_group; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.group_role_mapping
    ADD CONSTRAINT fk_group_role_group FOREIGN KEY (group_id) REFERENCES public.keycloak_group(id);


--
-- Name: realm_enabled_event_types fk_h846o4h0w8epx5nwedrf5y69j; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.realm_enabled_event_types
    ADD CONSTRAINT fk_h846o4h0w8epx5nwedrf5y69j FOREIGN KEY (realm_id) REFERENCES public.realm(id);


--
-- Name: realm_events_listeners fk_h846o4h0w8epx5nxev9f5y69j; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.realm_events_listeners
    ADD CONSTRAINT fk_h846o4h0w8epx5nxev9f5y69j FOREIGN KEY (realm_id) REFERENCES public.realm(id);


--
-- Name: identity_provider_mapper fk_idpm_realm; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.identity_provider_mapper
    ADD CONSTRAINT fk_idpm_realm FOREIGN KEY (realm_id) REFERENCES public.realm(id);


--
-- Name: idp_mapper_config fk_idpmconfig; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.idp_mapper_config
    ADD CONSTRAINT fk_idpmconfig FOREIGN KEY (idp_mapper_id) REFERENCES public.identity_provider_mapper(id);


--
-- Name: web_origins fk_lojpho213xcx4wnkog82ssrfy; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.web_origins
    ADD CONSTRAINT fk_lojpho213xcx4wnkog82ssrfy FOREIGN KEY (client_id) REFERENCES public.client(id);


--
-- Name: client_default_roles fk_nuilts7klwqw2h8m2b5joytky; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.client_default_roles
    ADD CONSTRAINT fk_nuilts7klwqw2h8m2b5joytky FOREIGN KEY (client_id) REFERENCES public.client(id);


--
-- Name: scope_mapping fk_ouse064plmlr732lxjcn1q5f1; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.scope_mapping
    ADD CONSTRAINT fk_ouse064plmlr732lxjcn1q5f1 FOREIGN KEY (client_id) REFERENCES public.client(id);


--
-- Name: client fk_p56ctinxxb9gsk57fo49f9tac; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.client
    ADD CONSTRAINT fk_p56ctinxxb9gsk57fo49f9tac FOREIGN KEY (realm_id) REFERENCES public.realm(id);


--
-- Name: protocol_mapper fk_pcm_realm; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.protocol_mapper
    ADD CONSTRAINT fk_pcm_realm FOREIGN KEY (client_id) REFERENCES public.client(id);


--
-- Name: credential fk_pfyr0glasqyl0dei3kl69r6v0; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.credential
    ADD CONSTRAINT fk_pfyr0glasqyl0dei3kl69r6v0 FOREIGN KEY (user_id) REFERENCES public.user_entity(id);


--
-- Name: protocol_mapper_config fk_pmconfig; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.protocol_mapper_config
    ADD CONSTRAINT fk_pmconfig FOREIGN KEY (protocol_mapper_id) REFERENCES public.protocol_mapper(id);


--
-- Name: default_client_scope fk_r_def_cli_scope_realm; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.default_client_scope
    ADD CONSTRAINT fk_r_def_cli_scope_realm FOREIGN KEY (realm_id) REFERENCES public.realm(id);


--
-- Name: default_client_scope fk_r_def_cli_scope_scope; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.default_client_scope
    ADD CONSTRAINT fk_r_def_cli_scope_scope FOREIGN KEY (scope_id) REFERENCES public.client_scope(id);


--
-- Name: client_scope fk_realm_cli_scope; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.client_scope
    ADD CONSTRAINT fk_realm_cli_scope FOREIGN KEY (realm_id) REFERENCES public.realm(id);


--
-- Name: required_action_provider fk_req_act_realm; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.required_action_provider
    ADD CONSTRAINT fk_req_act_realm FOREIGN KEY (realm_id) REFERENCES public.realm(id);


--
-- Name: resource_uris fk_resource_server_uris; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.resource_uris
    ADD CONSTRAINT fk_resource_server_uris FOREIGN KEY (resource_id) REFERENCES public.resource_server_resource(id);


--
-- Name: role_attribute fk_role_attribute_id; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.role_attribute
    ADD CONSTRAINT fk_role_attribute_id FOREIGN KEY (role_id) REFERENCES public.keycloak_role(id);


--
-- Name: realm_supported_locales fk_supported_locales_realm; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.realm_supported_locales
    ADD CONSTRAINT fk_supported_locales_realm FOREIGN KEY (realm_id) REFERENCES public.realm(id);


--
-- Name: user_federation_config fk_t13hpu1j94r2ebpekr39x5eu5; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.user_federation_config
    ADD CONSTRAINT fk_t13hpu1j94r2ebpekr39x5eu5 FOREIGN KEY (user_federation_provider_id) REFERENCES public.user_federation_provider(id);


--
-- Name: user_group_membership fk_user_group_user; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.user_group_membership
    ADD CONSTRAINT fk_user_group_user FOREIGN KEY (user_id) REFERENCES public.user_entity(id);


--
-- Name: policy_config fkdc34197cf864c4e43; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.policy_config
    ADD CONSTRAINT fkdc34197cf864c4e43 FOREIGN KEY (policy_id) REFERENCES public.resource_server_policy(id);


--
-- Name: identity_provider_config fkdc4897cf864c4e43; Type: FK CONSTRAINT; Schema: public; Owner: keycloak
--

ALTER TABLE ONLY public.identity_provider_config
    ADD CONSTRAINT fkdc4897cf864c4e43 FOREIGN KEY (identity_provider_id) REFERENCES public.identity_provider(internal_id);


--
-- PostgreSQL database dump complete
--

