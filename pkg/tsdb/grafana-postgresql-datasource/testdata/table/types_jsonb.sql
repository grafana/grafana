-- SELECT * FROM tbl
-- test jsonb data types including complex structures and edge cases
CREATE TEMPORARY TABLE tbl (
    id integer,
    simple_json jsonb,
    simple_json_nn jsonb NOT NULL,
    complex_json jsonb,
    array_json jsonb,
    nested_json jsonb,
    empty_json jsonb,
    null_json jsonb,
    network_response jsonb
);

INSERT INTO tbl (id, simple_json, simple_json_nn, complex_json, array_json, nested_json, empty_json, null_json, network_response) VALUES
(1, '{"key": "value"}', '{"status": "active"}', '{"user": {"id": 123, "name": "John Doe", "email": "john@example.com"}, "metadata": {"created": "2023-01-01", "tags": ["user", "active"]}}', '[1, 2, 3, "test"]', '{"level1": {"level2": {"level3": {"data": "deep"}}}}', '{}', 'null', '{"code": "network_error", "message": "The restore request was not successful The request failed because the MSISDN does not exist in the PPS."}'),
(2, '{"number": 42, "boolean": true}', '{"status": "inactive"}', '{"product": {"id": "abc-123", "price": 99.99, "available": true}, "inventory": {"count": 5, "warehouse": "US-WEST"}}', '[]', '{"config": {"database": {"host": "localhost", "port": 5432, "ssl": false}}}', '[]', NULL, '{"code": "network_error", "message": "The imei for the device 007abee2-2105-459b-b4a9-d218c8180a84 could not be found"}'),
(3, NULL, '{"status": "pending"}', NULL, '[{"id": 1, "name": "item1"}, {"id": 2, "name": "item2"}]', NULL, '{"empty": {}}', 'null', '[]'),
(4, '{"special_chars": "test with spaces and symbols: !@#$%^&*()"}', '{"unicode": "测试 🚀 émojis"}', '{"error": {"code": 500, "message": "Internal server error", "details": {"stack_trace": "Error at line 42", "timestamp": "2023-12-24T14:30:00Z"}}}', '[null, true, false, 0, "", {}]', '{"a": {"b": {"c": {"d": {"e": "very deep nesting"}}}}}', 'null', 'null', '{"code": "network_error", "message": "The imei for the device cdfd9055-3b61-46f3-945a-dfd0f6aa4f27 could not be found"}');
