-- SELECT * FROM tbl WHERE current_mood = 'happy';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'mood'
    ) THEN
        CREATE TYPE mood AS ENUM ('sad', 'ok', 'happy');
    END IF;
END$$;

CREATE TEMPORARY TABLE tbl (
    name text,
    current_mood mood
);
INSERT INTO tbl VALUES ('Moe', 'happy');
